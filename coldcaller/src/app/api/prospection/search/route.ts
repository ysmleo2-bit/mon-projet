/**
 * POST /api/prospection/search
 * Recherche d'entreprises via SIRENE + enrichissement basique (dirigeant, site)
 */

import { NextRequest, NextResponse } from "next/server";
import type { Prospect, Dirigeant, SearchParams } from "@/lib/types-prospection";

export const dynamic     = "force-dynamic";
export const maxDuration = 30;

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
    departement?: string;
    site_internet?: string;
    telephone?: string;
    tranche_effectif_salarie?: string;
  };
}

function sireneToProspect(r: SireneResult, secteur: string): Prospect {
  const now = new Date().toISOString();

  const dirigeants: Dirigeant[] = (r.dirigeants ?? []).map((d) => ({
    nom:     d.nom ?? "",
    prenoms: d.prenoms,
    qualite: d.qualite,
  }));

  const principal = dirigeants[0];
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

  // Déterminer statut initial
  const hasEmail  = false;
  const hasSite   = !!siteWeb;
  const statut    = hasSite ? "a_enrichir" : "nouveau";

  return {
    id:                 `prospect-${r.siren}`,
    siren:              r.siren,
    siret:              r.siege?.siret,
    nom:                r.nom_raison_sociale ?? r.nom_complet,
    nomCommercial:      r.nom_complet !== r.nom_raison_sociale ? r.nom_complet : undefined,
    codeNaf:            r.activite_principale ?? "",
    libelleNaf:         r.libelle_activite_principale ?? "",
    secteur,
    adresse:            [r.siege?.numero_voie, r.siege?.libelle_voie].filter(Boolean).join(" "),
    ville:              r.siege?.libelle_commune,
    codePostal:         r.siege?.code_postal,
    departement:        r.siege?.departement,
    trancheEffectifs:   r.siege?.tranche_effectif_salarie ?? r.tranche_effectif_salarie,
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
    actions:            [{
      date:   now,
      type:   "enrichissement",
      detail: "Prospect créé depuis SIRENE",
    }],
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json() as SearchParams & { secteur?: string };
  const {
    nafCodes  = [],
    secteur   = "",
    departement,
    ville,
    trancheMin,
    page    = 1,
    perPage = 50,
  } = body;

  if (!nafCodes.length && !secteur) {
    return NextResponse.json({ error: "nafCodes ou secteur requis" }, { status: 400 });
  }

  try {
    const BASE = "https://recherche-entreprises.api.gouv.fr/search";
    const dept = departement || (ville ? "" : "");

    // Construire les paramètres communs
    const common: Record<string, string> = {
      per_page:                    String(perPage),
      page:                        String(page),
      statut_diffusion_etablissement: "O",
      // n'inclure que les entreprises actives
      etat_administratif_etablissement: "A",
    };
    if (dept)      common.departement = dept;
    if (trancheMin) common.tranche_effectif_salarie = trancheMin;

    const toQs = (extra: Record<string, string>) =>
      Object.entries({ ...common, ...extra })
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join("&");

    // ── Requêtes en parallèle : NAF codes + texte libre ───────────────────────
    const fetches: Promise<SireneResult[]>[] = [];

    // Par code NAF
    for (const naf of nafCodes.slice(0, 5)) {
      fetches.push(
        fetch(`${BASE}?${toQs({ activite_principale: naf })}`, {
          signal: AbortSignal.timeout(10_000),
        })
          .then((r) => r.ok ? r.json() as Promise<{ results: SireneResult[] }> : { results: [] })
          .then((j) => j.results ?? [])
          .catch(() => [])
      );
      // Page 2 pour plus de résultats
      fetches.push(
        fetch(`${BASE}?${toQs({ activite_principale: naf, page: String(page + 1) })}`, {
          signal: AbortSignal.timeout(10_000),
        })
          .then((r) => r.ok ? r.json() as Promise<{ results: SireneResult[] }> : { results: [] })
          .then((j) => j.results ?? [])
          .catch(() => [])
      );
    }

    // Recherche texte libre (secteur)
    if (secteur) {
      fetches.push(
        fetch(`${BASE}?${toQs({ q: secteur })}`, { signal: AbortSignal.timeout(10_000) })
          .then((r) => r.ok ? r.json() as Promise<{ results: SireneResult[] }> : { results: [] })
          .then((j) => j.results ?? [])
          .catch(() => [])
      );
    }

    const pages   = await Promise.all(fetches);
    const allRaw  = pages.flat();

    // Dédupliquer par SIREN
    const seen    = new Set<string>();
    const unique  = allRaw.filter((r) => {
      if (!r?.siren || seen.has(r.siren)) return false;
      seen.add(r.siren);
      return true;
    });

    // Convertir en Prospects
    const label = secteur || nafCodes.join(", ");
    const prospects = unique.map((r) => sireneToProspect(r, label));

    // Sauvegarder en DB
    const { dbUpsertProspects } = await import("@/lib/db-prospection");
    await dbUpsertProspects(prospects);

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
