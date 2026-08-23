/**
 * POST /api/prospection/search
 * Recherche d'entreprises via SIRENE
 *
 * SIRENE API limits:
 *  - per_page max = 25 (50 returns 0 results)
 *  - departement= boosts but doesn't hard-filter → post-filter on siege.departement
 *  - statut_diffusion_etablissement=O causes 0 results (remove it)
 *  - etat_administratif_etablissement=A is ignored (no effect)
 */

import { NextRequest, NextResponse } from "next/server";
import type { Prospect, Dirigeant, SearchParams } from "@/lib/types-prospection";

export const dynamic     = "force-dynamic";
export const maxDuration = 30;

// SIRENE per_page hard limit
const SIRENE_PER_PAGE = 25;
// Pages fetched per NAF code (4 × 25 = 100 per NAF)
const PAGES_PER_NAF = 4;

// ── Types SIRENE API ──────────────────────────────────────────────────────────
interface SireneResult {
  siren:             string;
  nom_complet:       string;
  nom_raison_sociale?: string;
  activite_principale?: string;
  libelle_activite_principale?: string;
  tranche_effectif_salarie?: string;
  date_creation?: string;
  dirigeants?: Array<{
    nom?: string;
    prenoms?: string;
    qualite?: string;
    date_naissance_formate?: string;
  }>;
  siege: {
    siret?: string;
    libelle_commune?: string;
    code_postal?: string;
    numero_voie?: string;
    libelle_voie?: string;
    adresse?: string;
    departement?: string;
    site_internet?: string;
    telephone?: string;
    tranche_effectif_salarie?: string;
  };
}

// Tranche codes sorted in ascending order for ≥ comparison
const TRANCHE_ORDER = ["00","01","02","03","11","12","21","22","31","32","41","42","51","52","53"];
const TRANCHE_SET   = new Set(TRANCHE_ORDER);

function trancheGte(code: string, min: string): boolean {
  return TRANCHE_ORDER.indexOf(code) >= TRANCHE_ORDER.indexOf(min);
}
function trancheLte(code: string, max: string): boolean {
  return TRANCHE_ORDER.indexOf(code) <= TRANCHE_ORDER.indexOf(max);
}

/**
 * Retourne le code tranche effectif fiable pour filtrage.
 * Règle : utilise le siège s'il est dans TRANCHE_ORDER (pas "NN"),
 * sinon tente le niveau entreprise. Retourne null si aucun code fiable.
 * "NN" = unité non employeuse ou non renseignée → indexOf = -1 → BUG si naïvement utilisé.
 */
function getTrancheCode(r: SireneResult): string | null {
  const sieteT = r.siege?.tranche_effectif_salarie;
  const unitT  = r.tranche_effectif_salarie;
  if (sieteT && TRANCHE_SET.has(sieteT))  return sieteT;
  if (unitT  && TRANCHE_SET.has(unitT))   return unitT;
  return null; // "NN", vide, ou code inconnu → on ne peut pas filtrer
}

function sireneToProspect(r: SireneResult, secteur: string): Prospect {
  const now = new Date().toISOString();

  const dirigeants: Dirigeant[] = (r.dirigeants ?? [])
    .filter((d) => d.nom) // ignorer personnes morales
    .map((d) => ({
      nom:     d.nom ?? "",
      prenoms: d.prenoms,
      qualite: d.qualite,
    }));

  // Préférer le gérant / président comme dirigeant principal
  const priorityQualites = ["gérant","président","directeur général","associé gérant"];
  const principal = dirigeants.find((d) =>
    priorityQualites.some((q) => d.qualite?.toLowerCase().includes(q))
  ) ?? dirigeants[0];

  const dirigeantPrincipal = principal
    ? [principal.prenoms, principal.nom].filter(Boolean).join(" ").trim()
    : undefined;

  const siteRaw = r.siege?.site_internet;
  const siteWeb = siteRaw
    ? siteRaw.replace(/^https?:\/\//, "").replace(/\/$/, "")
    : undefined;

  const phone = r.siege?.telephone
    ? r.siege.telephone.replace(/^\+33\s?/, "0").replace(/\s+/g, " ").trim()
    : undefined;

  // Utiliser getTrancheCode pour éviter de stocker "NN" comme tranche valide
  const tranche = getTrancheCode(r) ?? r.siege?.tranche_effectif_salarie ?? r.tranche_effectif_salarie;
  const statut = siteWeb ? "a_enrichir" : "nouveau";

  return {
    id:                 `prospect-${r.siren}`,
    siren:              r.siren,
    siret:              r.siege?.siret,
    nom:                r.nom_raison_sociale ?? r.nom_complet,
    nomCommercial:      r.nom_complet !== r.nom_raison_sociale ? r.nom_complet : undefined,
    codeNaf:            r.activite_principale ?? "",
    libelleNaf:         r.libelle_activite_principale ?? "",
    secteur,
    adresse:            r.siege?.adresse ?? [r.siege?.numero_voie, r.siege?.libelle_voie].filter(Boolean).join(" "),
    ville:              r.siege?.libelle_commune,
    codePostal:         r.siege?.code_postal,
    departement:        r.siege?.departement,
    trancheEffectifs:   tranche,
    dateCreation:       r.date_creation,
    siteWeb,
    dirigeants,
    dirigeantPrincipal,
    fonctionDirigeant:  principal?.qualite,
    telephonePro:       phone,
    statut,
    createdAt:          now,
    updatedAt:          now,
    sources:            ["sirene"],
    actions:            [{ date: now, type: "enrichissement", detail: "Prospect créé depuis SIRENE" }],
  };
}

async function fetchSirenePage(qs: string): Promise<SireneResult[]> {
  try {
    const res = await fetch(
      `https://recherche-entreprises.api.gouv.fr/search?${qs}`,
      { signal: AbortSignal.timeout(8_000) }
    );
    if (!res.ok) return [];
    const json = await res.json() as { results?: SireneResult[] };
    return json.results ?? [];
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json() as SearchParams & { secteur?: string };
  const {
    nafCodes    = [],
    secteur     = "",
    departement,
    trancheMin,
    trancheMax,
    perPage     = 50,
  } = body;

  if (!nafCodes.length && !secteur) {
    return NextResponse.json({ error: "nafCodes ou secteur requis" }, { status: 400 });
  }

  try {
    // ── Common params (sans statut_diffusion qui casse tout) ──────────────────
    const baseParams: Record<string, string> = {
      per_page: String(SIRENE_PER_PAGE),
    };
    // departement= booste les résultats du département mais ne filtre pas strictement
    if (departement) baseParams.departement = departement;

    const buildQs = (extra: Record<string, string>) =>
      new URLSearchParams({ ...baseParams, ...extra }).toString();

    // ── Requêtes en parallèle ─────────────────────────────────────────────────
    const fetches: Promise<SireneResult[]>[] = [];

    // 4 pages par code NAF (4 × 25 = 100 résultats max par NAF)
    for (const naf of nafCodes.slice(0, 5)) {
      for (let p = 1; p <= PAGES_PER_NAF; p++) {
        fetches.push(fetchSirenePage(buildQs({ activite_principale: naf, page: String(p) })));
      }
    }

    // 2 pages de recherche texte libre (secteur)
    if (secteur) {
      fetches.push(fetchSirenePage(buildQs({ q: secteur, page: "1" })));
      fetches.push(fetchSirenePage(buildQs({ q: secteur, page: "2" })));
    }

    const pages  = await Promise.all(fetches);
    const allRaw = pages.flat();

    // ── Post-filtre département (l'API booste mais ne filtre pas) ─────────────
    const deptFiltered = departement
      ? allRaw.filter((r) => r.siege?.departement === departement)
      : allRaw;

    // ── Post-filtre taille (plage min–max) ───────────────────────────────────
    // IMPORTANT: utiliser getTrancheCode() qui valide que le code est dans
    // TRANCHE_ORDER. "NN" (non renseigné) a indexOf = -1 → -1 <= n est toujours
    // true → causerait des faux positifs massifs avec un filtre max seul.
    const trancheFiltered = (trancheMin || trancheMax)
      ? deptFiltered.filter((r) => {
          const t = getTrancheCode(r);
          if (!t) return false; // "NN" ou inconnu → exclure quand un filtre est actif
          if (trancheMin && !trancheGte(t, trancheMin)) return false;
          if (trancheMax && !trancheLte(t, trancheMax)) return false;
          return true;
        })
      : deptFiltered;

    // ── Déduplique par SIREN ──────────────────────────────────────────────────
    const seen   = new Set<string>();
    const unique = trancheFiltered.filter((r) => {
      if (!r?.siren || seen.has(r.siren)) return false;
      seen.add(r.siren);
      return true;
    });

    // Convertir en Prospects (cap à perPage ou 200 max)
    const cap       = Math.min(perPage, 200);
    const label     = secteur || nafCodes.join(", ");
    const prospects = unique.slice(0, cap).map((r) => sireneToProspect(r, label));

    // Sauvegarder en DB (fire-and-forget si erreur DB)
    try {
      const { dbUpsertProspects } = await import("@/lib/db-prospection");
      await dbUpsertProspects(prospects);
    } catch (dbErr) {
      console.warn("[prospection/search] DB save skipped:", dbErr);
    }

    return NextResponse.json({
      prospects,
      total: prospects.length,
      raw:   unique.length,
    });
  } catch (err) {
    console.error("[prospection/search]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
