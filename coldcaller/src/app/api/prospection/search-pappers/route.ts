/**
 * POST /api/prospection/search-pappers
 * Recherche d'entreprises françaises via l'API Pappers v2.
 *
 * Classement automatique par potentiel commercial :
 *   1. CA élevé (chiffre_affaires desc)
 *   2. Score composite (richesse des infos + capital + ancienneté)
 *
 * Prérequis : PAPPERS_API_KEY dans les variables d'environnement Vercel.
 * API Pappers : https://www.pappers.fr/api/documentation
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import type { Prospect, Dirigeant } from "@/lib/types-prospection";

export const dynamic     = "force-dynamic";
export const maxDuration = 45;

// ── Types réponse Pappers v2 ──────────────────────────────────────────────────
interface PappersSiege {
  siret?:          string;
  adresse_ligne_1?: string;
  adresse_ligne_2?: string;
  code_postal?:    string;
  ville?:          string;
  departement?:    string;
  telephone?:      string;
  email?:          string;
  site_internet?:  string;
}

interface PappersResultat {
  siren:               string;
  nom_entreprise?:     string;
  denomination?:       string;
  forme_juridique?:    string;
  code_naf?:           string;
  libelle_code_naf?:   string;
  date_creation?:      string;
  tranche_effectif?:   string;
  effectif_min?:       number;
  effectif_max?:       number;
  annee_effectif?:     number;
  capital?:            number | null;
  chiffre_affaires?:   number | null;
  resultat?:           number | null;
  annee_finances?:     number | null;
  effectifs_finances?: number | null;
  siege?:              PappersSiege;
  entreprise_cessee?:  boolean;
}

interface PappersRechercheResponse {
  total?:     number;
  resultats?: PappersResultat[];
}

// ── Score de priorité commerciale ─────────────────────────────────────────────
function commercialScore(r: PappersResultat): number {
  let score = 0;

  // 1. CA (pondération principale — max ~90 pts pour 100M€)
  if (r.chiffre_affaires && r.chiffre_affaires > 0) {
    score += Math.log10(r.chiffre_affaires) * 10;
  }

  // 2. Richesse des données (max 18 pts)
  const richesse = [
    !!r.chiffre_affaires && r.chiffre_affaires > 0,
    !!r.capital && r.capital > 0,
    !!r.siege?.email,
    !!r.siege?.telephone,
    !!r.siege?.site_internet,
    !!r.siege?.adresse_ligne_1,
  ].filter(Boolean).length * 3;
  score += richesse;

  // 3. Capital (proxy solidité — max ~18 pts pour 1M€)
  if (r.capital && r.capital > 0) {
    score += Math.min(Math.log10(r.capital) * 3, 18);
  }

  // 4. Ancienneté
  if (r.date_creation) {
    const age = new Date().getFullYear() - new Date(r.date_creation).getFullYear();
    if (age >= 5)  score += 2;
    if (age >= 10) score += 2;
  }

  return score;
}

// ── Normalise un numéro de téléphone ─────────────────────────────────────────
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
  r:       PappersResultat,
  secteur: string,
  user?:   { userId: string; name: string }
): Prospect {
  const now = new Date().toISOString();

  const ca          = r.chiffre_affaires && r.chiffre_affaires > 0 ? r.chiffre_affaires : undefined;
  const resultat    = r.resultat ?? undefined;
  const effectifReel = r.effectifs_finances ?? undefined;
  const caAnnee     = r.annee_finances?.toString();

  const siteRaw = r.siege?.site_internet;
  const siteWeb = siteRaw
    ? siteRaw.replace(/^https?:\/\//, "").replace(/\/$/, "")
    : undefined;

  const phone = normalizePhone(r.siege?.telephone);
  const email = r.siege?.email ?? undefined;

  const statut = siteWeb ? "a_enrichir" : "nouveau";

  return {
    id:                   `prospect-${r.siren}`,
    siren:                r.siren,
    siret:                r.siege?.siret,
    nom:                  r.nom_entreprise ?? r.denomination ?? r.siren,
    codeNaf:              r.code_naf ?? "",
    libelleNaf:           r.libelle_code_naf ?? "",
    secteur,
    adresse:              [r.siege?.adresse_ligne_1, r.siege?.adresse_ligne_2].filter(Boolean).join(", "),
    ville:                r.siege?.ville,
    codePostal:           r.siege?.code_postal,
    departement:          r.siege?.departement,
    dateCreation:         r.date_creation,
    formeJuridique:       r.forme_juridique,
    chiffreAffaires:      ca,
    chiffreAffairesAnnee: caAnnee,
    resultatNet:          resultat !== undefined && resultat !== null ? resultat : undefined,
    capitalSocial:        r.capital && r.capital > 0 ? r.capital : undefined,
    effectifsReels:       effectifReel,
    siteWeb,
    emailDirigeant:       email,
    emailSource:          email ? "pappers" : undefined,
    emailVerifie:         !!email,
    telephonePro:         phone,
    dirigeants:           [],   // non disponible dans la recherche — récupérable via enrich-pappers
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

// ── Appel API Pappers /v2/recherche ───────────────────────────────────────────
async function searchPappers(params: {
  nafCodes:     string[];
  departement?: string;
  keyword?:     string;   // filtre textuel sur nom d'entreprise (param Pappers: q)
  parPage:      number;
  page:         number;
}): Promise<PappersResultat[]> {
  const key = process.env.PAPPERS_API_KEY;
  if (!key) return [];

  const qs = new URLSearchParams({
    api_token: key,
    par_page:  String(Math.min(params.parPage, 50)),
    page:      String(params.page),
    classement: "chiffre_affaires",   // tri CA décroissant (valeur Pappers v2)
    entreprise_cessee: "false",
  });

  if (params.nafCodes.length > 0) {
    qs.set("code_naf", params.nafCodes.join(","));
  }
  if (params.departement) qs.set("departement", params.departement);
  // Filtre textuel : réduit le bruit pour les secteurs à code NAF générique
  // (ex. 56.30Z = "Débits de boissons" couvre bars ET boîtes de nuit — le
  // keyword "discothèque" cible uniquement les établissements de nuit réels)
  if (params.keyword)     qs.set("q", params.keyword);

  try {
    const res = await fetch(
      `https://api.pappers.fr/v2/recherche?${qs.toString()}`,
      { signal: AbortSignal.timeout(15_000) }
    );
    if (!res.ok) {
      const errText = await res.text();
      console.error("[pappers/search] HTTP", res.status, errText);
      return [];
    }
    const data = await res.json() as PappersRechercheResponse;
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
    keyword?:     string;   // filtre textuel optionnel sur nom d'entreprise
    perPage?:     number;
  };

  const {
    nafCodes    = [],
    secteur     = "",
    departement,
    keyword,
    perPage     = 50,
  } = body;

  if (!nafCodes.length && !secteur) {
    return NextResponse.json({ error: "nafCodes requis" }, { status: 400 });
  }

  try {
    // Fetch 2 pages en parallèle (max 50 × 2 = 100)
    const pages = await Promise.all([
      searchPappers({ nafCodes, departement, keyword, parPage: 50, page: 1 }),
      searchPappers({ nafCodes, departement, keyword, parPage: 50, page: 2 }),
    ]);
    const allRaw = pages.flat();

    // Déduplique par SIREN
    const seen   = new Set<string>();
    const unique = allRaw.filter((r) => {
      if (!r?.siren || seen.has(r.siren)) return false;
      seen.add(r.siren);
      return true;
    });

    // Re-tri côté serveur : CA connu d'abord, puis score composite
    const scored = unique
      .map((r) => ({ r, score: commercialScore(r) }))
      .sort((a, b) => {
        const aHasCa = (a.r.chiffre_affaires ?? 0) > 0;
        const bHasCa = (b.r.chiffre_affaires ?? 0) > 0;
        if (aHasCa !== bHasCa) return aHasCa ? -1 : 1;
        return b.score - a.score;
      })
      .slice(0, Math.min(perPage, 200));

    const label     = secteur || nafCodes.join(", ");
    const prospects = scored.map(({ r }) =>
      pappersToProspect(r, label, user ?? undefined)
    );

    // Sauvegarde DB
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
