/**
 * POST /api/prospection/enrich-dork
 * Recherche Google "dork" pour trouver le mobile du dirigeant.
 *
 * Principe : Google indexe des milliers de pages (devis, annonces Leboncoin,
 * profils pro, forums métier…) où le dirigeant a publié son 06/07.
 * Une requête du type  "terrassement" "besançon" "+33 6"  retourne ces pages.
 *
 * Ordre de priorité des requêtes :
 *  1. "[dirigeant]" "[ville]" "+33 6"  ← le plus précis
 *  2. "[dirigeant]" "[secteur]" "+33 6"
 *  3. "[nom société]" "[ville]" "+33 6"
 *  … mêmes variantes avec "+33 7" (07)
 *
 * API : Serper.dev (google.serper.dev) — env SERPER_API_KEY
 * Coût : ~0.001 $ / requête (très faible)
 * Alternative gratuite : Google Custom Search JSON API (100/jour gratuit)
 *
 * Prérequis : SERPER_API_KEY dans les variables d'environnement Vercel.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";

export const dynamic     = "force-dynamic";
export const maxDuration = 30;

// ── Regex mobiles français ────────────────────────────────────────────────────
// Formes reconnues : +33 6 12 34 56 78 / +33612345678 / +33 6.12.34.56.78
//                   06 12 34 56 78 / 0612345678 / 06.12.34.56.78
const MOBILE_RE = /(?:\+33[\s.\-]?[67][\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}|0[67][\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2})/g;

function normalizeMobile(raw: string): string {
  let p = raw.replace(/[\s.\-]/g, "");
  if (p.startsWith("+33")) p = "0" + p.slice(3);
  if (p.startsWith("0033")) p = "0" + p.slice(4);
  if (p.length === 10 && /^0[67]/.test(p)) {
    return p.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4 $5");
  }
  return raw.trim();
}

function isValidMobile(s: string): boolean {
  const d = s.replace(/\s/g, "");
  return /^0[67]\d{8}$/.test(d);
}

/** Extrait tous les numéros mobiles FR d'un texte */
function extractMobiles(text: string): string[] {
  const raw = text.match(MOBILE_RE) ?? [];
  return Array.from(new Set(raw.map(normalizeMobile).filter(isValidMobile)));
}

// ── Appel Serper (Google Search) ──────────────────────────────────────────────
interface SerperResult {
  title?:   string;
  link?:    string;
  snippet?: string;
}
interface SerperResponse {
  organic?: SerperResult[];
  answerBox?: { answer?: string; snippet?: string };
}

async function searchSerper(q: string, key: string): Promise<string[]> {
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method:  "POST",
      headers: {
        "X-API-KEY":    key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q, gl: "fr", hl: "fr", num: 10 }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) {
      console.error("[dork] Serper HTTP", res.status, await res.text());
      return [];
    }

    const data = await res.json() as SerperResponse;

    // Extraire des mobiles dans chaque snippet + title
    const mobiles: string[] = [];

    if (data.answerBox?.snippet) mobiles.push(...extractMobiles(data.answerBox.snippet));
    if (data.answerBox?.answer)  mobiles.push(...extractMobiles(data.answerBox.answer));

    for (const r of data.organic ?? []) {
      if (r.title)   mobiles.push(...extractMobiles(r.title));
      if (r.snippet) mobiles.push(...extractMobiles(r.snippet));
    }

    return Array.from(new Set(mobiles));
  } catch (err) {
    console.error("[dork] Serper error:", err);
    return [];
  }
}

// ── Nettoyage chaîne pour requête Google ──────────────────────────────────────
function esc(s: string): string {
  // Garder uniquement alphanum + espaces, max 40 cars pour éviter les requêtes trop longues
  return s.replace(/["""''`]/g, "").trim().slice(0, 40);
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { error: authError } = requireAuth(req);
  if (authError) return authError;

  const key = process.env.SERPER_API_KEY;
  if (!key) {
    return NextResponse.json({
      error:   "SERPER_API_KEY non configurée",
      message: "Ajoutez SERPER_API_KEY dans les variables d'environnement Vercel. Clé gratuite sur serper.dev (2 500 requêtes gratuites).",
    }, { status: 503 });
  }

  const body = await req.json() as {
    prospectId:          string;
    nom:                 string;
    ville?:              string;
    secteur?:            string;
    dirigeantPrincipal?: string;
  };

  const { prospectId, nom, ville, secteur, dirigeantPrincipal } = body;

  if (!prospectId || !nom) {
    return NextResponse.json({ error: "prospectId et nom requis" }, { status: 400 });
  }

  // ── Construction des requêtes dork ───────────────────────────────────────────
  // Économie de crédits Serper : seulement 2 groupes max (4 requêtes max/prospect)
  // On garde uniquement les requêtes géo-ciblées (ville) qui sont les plus précises.
  // Les variantes secteur sont abandonnées — trop larges, trop chères en crédits.
  //
  // Ordre :
  //  1. "[dirigeant]" "[ville]" "+33 6" / "+33 7"   ← 2 requêtes max
  //  2. "[nom société]" "[ville]" "+33 6" / "+33 7"  ← 2 requêtes max (fallback)
  // Total worst-case : 4 requêtes/prospect (vs 8 avant)

  const ville_ = esc(ville ?? "");
  const nom_   = esc(nom);

  // Prénom + nom du dirigeant (si dispo)
  const dirig = dirigeantPrincipal ? esc(dirigeantPrincipal) : "";

  // Génère les deux variantes mobiles (+33 6 ET +33 7) pour une requête base
  const mkQueries = (base: string): string[] => [
    `${base} "+33 6"`,
    `${base} "+33 7"`,
  ];

  // Pile de requêtes — uniquement les variantes géo (ville)
  const queryGroups: Array<string[]> = [];

  // 1. Dirigeant + ville (le plus ciblé — max 2 requêtes)
  if (dirig && ville_) {
    queryGroups.push(mkQueries(`"${dirig}" "${ville_}"`));
  }

  // 2. Nom société + ville (fallback — max 2 requêtes)
  if (ville_) {
    queryGroups.push(mkQueries(`"${nom_}" "${ville_}"`));
  }

  // ── Exécution waterfall : s'arrêter dès le premier mobile trouvé ────────────
  let foundMobile: string | null = null;
  let usedQuery:   string | null = null;
  let queriesRun  = 0;

  outer: for (const group of queryGroups) {
    for (const q of group) {
      queriesRun++;
      console.info(`[dork] query: ${q}`);
      const mobiles = await searchSerper(q, key);
      if (mobiles.length > 0) {
        foundMobile = mobiles[0];
        usedQuery   = q;
        console.info(`[dork] found ${mobiles[0]} via "${q}"`);
        break outer;
      }
    }
  }

  if (!foundMobile) {
    return NextResponse.json({
      ok:          false,
      found:       false,
      queriesRun,
      message:     "Aucun mobile trouvé via Google dork",
    });
  }

  // ── Persistance ──────────────────────────────────────────────────────────────
  const now   = new Date().toISOString();
  const patch: Record<string, unknown> = {
    telephoneMobile:   foundMobile,
    dorkEnrichedAt:    now,
    actions: [{
      date:   now,
      type:   "enrichissement",
      detail: `Mobile Google dork : ${foundMobile} (requête: ${usedQuery})`,
    }],
  };

  try {
    const { dbUpdateProspect } = await import("@/lib/db-prospection");
    await dbUpdateProspect(prospectId, patch as any);
  } catch (dbErr) {
    console.warn("[dork] DB save skipped:", dbErr);
  }

  return NextResponse.json({
    ok:          true,
    found:       true,
    mobile:      foundMobile,
    query:       usedQuery,
    queriesRun,
    message:     `📱 Mobile trouvé : ${foundMobile}`,
  });
}
