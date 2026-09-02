/**
 * POST /api/prospection/search-pappers
 * Recherche d'entreprises françaises via l'API Pappers.
 *
 * Avantages vs SIRENE :
 *  - Chiffre d'affaires disponible dans les résultats de recherche
 *  - Capital social, forme juridique, résultat net
 *  - Dirigeants avec fonction
 *  - Classement automatique par potentiel commercial (CA → infos → taille)
 *
 * Prérequis : PAPPERS_API_KEY dans les variables d'environnement Vercel.
 * Tarif : ~1 crédit par résultat complet. Vérifier https://pappers.fr/api/tarifs
 *
 * API Pappers : https://www.pappers.fr/api/documentation
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import type { Prospect, Dirigeant } from "@/lib/types-prospection";

export const dynamic     = "force-dynamic";
export const maxDuration = 45;

// ── Types Pappers API ─────────────────────────────────────────────────────────
interface PappersDirigeant {
  nom?:     string;
  prenom?:  string;
  qualite?: string;
  date_de_naissance_formate?: string;
}

interface PappersSiege {
  siret?:        string;
  adresse_ligne_1?: string;
  adresse_ligne_2?: string;
  code_postal?:  string;
  ville?:        string;
  departement?:  string;
  latitude?:     number;
  longitude?:    number;
}

interface PappersResult {
  siren:                string;
  nom_entreprise?:      string;
  nom_complet?:         string;
  siret_siege?:         string;
  forme_juridique?:     string;
  code_naf?:            string;
  libelle_code_naf?:    string;
  date_creation?:       string;
  tranche_effectif?:    string;
  effectif?:            string;
  chiffre_affaires?:    number | null;
  resultat?:            number | null;
  capital?:             number | null;
  site_internet?:       string | null;
  email?:               string | null;
  telephone?:           string | null;
  siege?:               PappersSiege;
  dirigeants?:          PappersDirigeant[];
  // Champs comptes (si présents)
  chiffres_cles?: Array<{
    annee?: number;
    chiffre_affaires?: number;
    resultat?: number;
    effectifs?: number;
  }>;
}

interface PappersSearchResponse {
  total:     number;
  resultats: PappersResult[];
}

// ── Score de priorité commerciale ─────────────────────────────────────────────
/**
 * Calcule un score de priorité commerciale :
 * 1. CA élevé → fort potentiel
 * 2. Richesse des données → meilleure exploitabilité
 * 3. Capital / taille → proxy de solidité si pas de CA
 */
function commercialScore(r: PappersResult): number {
  let score = 0;

  // ── 1. Chiffre d'affaires (pondération 60 pts max) ─────────────────────────
  if (r.chiffre_affaires && r.chiffre_affaires > 0) {
    // log10(1M) ≈ 6 → *10 = 60 pts ; log10(100k) ≈ 5 → 50 pts
    score += Math.log10(r.chiffre_affaires) * 10;
  }

  // ── 2. Richesse des informations (max 18 pts) ──────────────────────────────
  const infoFlags = [
    !!r.chiffre_affaires,          // CA connu (+3)
    !!r.capital && r.capital > 0,  // Capital (+3)
    !!r.dirigeants?.length,        // Dirigeant identifié (+3)
    !!r.email,                     // Email (+3)
    !!r.telephone,                 // Téléphone (+3)
    !!r.site_internet,             // Site web (+3)
  ];
  score += infoFlags.filter(Boolean).length * 3;

  // ── 3. Solidité / taille proxy (max 20 pts) ───────────────────────────────
  if (r.capital && r.capital > 0) {
    // log10(1M€ capital) ≈ 6 → *3 = 18 pts
    score += Math.min(Math.log10(r.capital) * 3, 18);
  }

  // Ancienneté : entreprise > 5 ans = +2 pts
  if (r.date_creation) {
    const age = new Date().getFullYear() - new Date(r.date_creation).getFullYear();
    if (age >= 5) score += 2;
    if (age >= 10) score += 2;
  }

  return score;
}

// ── Normalise le numéro de téléphone Pappers ──────────────────────────────────
function normalizePhone(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  let p = raw.replace(/[\s.\-]/g, "");
  if (p.startsWith("+33")) p = "0" + p.slice(3);
  if (p.startsWith("0033")) p = "0" + p.slice(4);
  if (p.length === 10 && p.startsWith("0")) {
    return p.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4 $5");
  }
  return raw.trim();
}

// ── Mapping Pappers → Prospect ────────────────────────────────────────────────
function pappersToProspect(
  r:       PappersResult,
  secteur: string,
  user?:   { userId: string; name: string }
): Prospect {
  const now = new Date().toISOString();

  // Dirigeants
  const dirigeants: Dirigeant[] = (r.dirigeants ?? [])
    .filter((d) => d.nom || d.prenom)
    .map((d) => ({
      nom:     d.nom ?? "",
      prenoms: d.prenom,
      qualite: d.qualite,
    }));

  const priorityQualites = ["gérant", "président", "directeur général", "associé gérant", "pdg"];
  const principal = dirigeants.find((d) =>
    priorityQualites.some((q) => d.qualite?.toLowerCase().includes(q))
  ) ?? dirigeants[0];

  const dirigeantPrincipal = principal
    ? [principal.prenoms, principal.nom].filter(Boolean).join(" ").trim()
    : undefined;

  // Site web
  const siteRaw = r.site_internet;
  const siteWeb = siteRaw
    ? siteRaw.replace(/^https?:\/\//, "").replace(/\/$/, "")
    : undefined;

  // Chiffres financiers — prendre les plus récents si disponibles en chiffres_cles
  const latestComptes = r.chiffres_cles
    ?.filter((c) => c.chiffre_affaires)
    .sort((a, b) => (b.annee ?? 0) - (a.annee ?? 0))[0];

  const ca          = r.chiffre_affaires ?? latestComptes?.chiffre_affaires ?? undefined;
  const resultat    = r.resultat ?? latestComptes?.resultat ?? undefined;
  const effectifReel = latestComptes?.effectifs ?? undefined;

  // Statut initial
  const statut = siteWeb ? "a_enrichir" : "nouveau";

  return {
    id:                   `prospect-${r.siren}`,
    siren:                r.siren,
    siret:                r.siret_siege ?? r.siege?.siret,
    nom:                  r.nom_entreprise ?? r.nom_complet ?? r.siren,
    codeNaf:              r.code_naf ?? "",
    libelleNaf:           r.libelle_code_naf ?? "",
    secteur,
    adresse:              [r.siege?.adresse_ligne_1, r.siege?.adresse_ligne_2].filter(Boolean).join(", "),
    ville:                r.siege?.ville,
    codePostal:           r.siege?.code_postal,
    departement:          r.siege?.departement,
    trancheEffectifs:     undefined, // Pappers utilise string "11-49" ≠ SIRENE codes
    dateCreation:         r.date_creation,
    formeJuridique:       r.forme_juridique,
    chiffreAffaires:      ca && ca > 0 ? ca : undefined,
    chiffreAffairesAnnee: latestComptes?.annee?.toString(),
    resultatNet:          resultat && resultat !== 0 ? resultat : undefined,
    capitalSocial:        r.capital && r.capital > 0 ? r.capital : undefined,
    effectifsReels:       effectifReel,
    siteWeb,
    emailDirigeant:       r.email ?? undefined,
    emailSource:          r.email ? "pappers" : undefined,
    emailVerifie:         !!r.email,
    telephonePro:         normalizePhone(r.telephone),
    dirigeants,
    dirigeantPrincipal,
    fonctionDirigeant:    principal?.qualite,
    statut,
    pappersEnrichedAt:    now,
    createdAt:            now,
    updatedAt:            now,
    sources:              ["pappers"],
    actions:              [{ date: now, type: "enrichissement", detail: "Prospect créé depuis Pappers" }],
    assignedToId:         user?.userId,
    assignedTo:           user?.name,
  };
}

// ── Appel API Pappers ─────────────────────────────────────────────────────────
async function searchPappers(params: {
  nafCodes:     string[];
  departement?: string;
  ville?:       string;
  parPage:      number;
  page:         number;
}): Promise<PappersResult[]> {
  const key = process.env.PAPPERS_API_KEY;
  if (!key) return [];

  const qs = new URLSearchParams({
    api_token:  key,
    par_page:   String(Math.min(params.parPage, 50)),
    page:       String(params.page),
    champs_extra: "chiffres_cles,dirigeants,siege,site_internet,email,telephone,capital",
  });

  if (params.nafCodes.length > 0) {
    qs.set("code_naf", params.nafCodes.join(","));
  }
  if (params.departement) qs.set("departement", params.departement);
  if (params.ville)       qs.set("ville", params.ville);

  // Trier par CA décroissant si Pappers le supporte
  qs.set("trier_par", "chiffre_affaires");
  qs.set("ordre", "desc");

  try {
    const res = await fetch(
      `https://api.pappers.fr/v2/recherche?${qs.toString()}`,
      { signal: AbortSignal.timeout(15_000) }
    );
    if (!res.ok) {
      console.error("[pappers/search] HTTP", res.status, await res.text());
      return [];
    }
    const data = await res.json() as PappersSearchResponse;
    return data.resultats ?? [];
  } catch (err) {
    console.error("[pappers/search] error:", err);
    return [];
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { user, error: authError } = requireAuth(req);
  if (authError) return authError;

  if (!process.env.PAPPERS_API_KEY) {
    return NextResponse.json({
      error:   "PAPPERS_API_KEY non configurée",
      message: "Ajoutez PAPPERS_API_KEY dans les variables d'environnement Vercel.",
    }, { status: 503 });
  }

  const body = await req.json() as {
    nafCodes?:    string[];
    secteur?:     string;
    departement?: string;
    ville?:       string;
    perPage?:     number;
  };

  const {
    nafCodes    = [],
    secteur     = "",
    departement,
    ville,
    perPage     = 50,
  } = body;

  if (!nafCodes.length && !secteur) {
    return NextResponse.json({ error: "nafCodes ou secteur requis" }, { status: 400 });
  }

  try {
    // ── Fetch 2 pages en parallèle (max 50 × 2 = 100 résultats) ──────────────
    const pages = await Promise.all([
      searchPappers({ nafCodes, departement, ville, parPage: 50, page: 1 }),
      searchPappers({ nafCodes, departement, ville, parPage: 50, page: 2 }),
    ]);
    const allRaw = pages.flat();

    // ── Déduplique par SIREN ──────────────────────────────────────────────────
    const seen   = new Set<string>();
    const unique = allRaw.filter((r) => {
      if (!r?.siren || seen.has(r.siren)) return false;
      seen.add(r.siren);
      return true;
    });

    // ── Classement par potentiel commercial ────────────────────────────────────
    // 1er tri : CA élevé (non nul) en premier
    // 2ème tri : score global (infos + capital + ancienneté)
    const scored = unique
      .map((r) => ({ r, score: commercialScore(r) }))
      .sort((a, b) => {
        const aHasCa = (a.r.chiffre_affaires ?? 0) > 0;
        const bHasCa = (b.r.chiffre_affaires ?? 0) > 0;
        // CA connu → toujours avant CA inconnu
        if (aHasCa !== bHasCa) return aHasCa ? -1 : 1;
        return b.score - a.score;
      })
      .slice(0, Math.min(perPage, 200));

    const label     = secteur || nafCodes.join(", ");
    const prospects = scored.map(({ r }) =>
      pappersToProspect(r, label, user ?? undefined)
    );

    // ── Sauvegarder en DB et récupérer les données fusionnées ─────────────────
    let merged = prospects;
    try {
      const { dbUpsertProspects, dbGetProspectsByIds } = await import("@/lib/db-prospection");
      await dbUpsertProspects(prospects);
      const dbMap = await dbGetProspectsByIds(prospects.map((p) => p.id));
      merged = prospects.map((p) => dbMap.get(p.id) ?? p);
    } catch (dbErr) {
      console.warn("[search-pappers] DB save skipped:", dbErr);
    }

    return NextResponse.json({
      prospects: merged,
      total:     merged.length,
      raw:       unique.length,
      source:    "pappers",
      withCa:    scored.filter(({ r }) => (r.chiffre_affaires ?? 0) > 0).length,
    });
  } catch (err) {
    console.error("[search-pappers]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
