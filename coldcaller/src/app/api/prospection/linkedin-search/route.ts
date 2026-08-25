/**
 * POST /api/prospection/linkedin-search
 *
 * Recherche le profil LinkedIn d'un dirigeant via l'API interne LinkedIn
 * (Voyager API — fetch pur, pas de Playwright → compatible Vercel).
 *
 * Authentification : cookie li_at du compte dédié stocké dans LINKEDIN_COOKIE.
 * Flux :
 *   1. GET linkedin.com/ avec li_at → récupère JSESSIONID (CSRF token)
 *   2. GET voyager/api/search/blended?keywords=… → résultats personnes
 *   3. Retourne profil le plus pertinent (nom + entreprise)
 *
 * Env var requise : LINKEDIN_COOKIE = valeur du cookie li_at (sans "li_at=")
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";

export const dynamic     = "force-dynamic";
export const maxDuration = 15;

// ── Types réponse Voyager ─────────────────────────────────────────────────────
interface MiniProfile {
  firstName:        string;
  lastName:         string;
  occupation?:      string;
  publicIdentifier: string;
}

interface VoyagerElement {
  hitInfo?: {
    "com.linkedin.voyager.search.SearchProfile"?: {
      miniProfile?:  MiniProfile;
      headline?:     string;
      location?:     string;
    };
  };
}

interface VoyagerCluster {
  elements?: VoyagerElement[];
}

interface VoyagerResponse {
  data?: {
    elements?: VoyagerCluster[];
  };
  included?: Array<{
    $type?:           string;
    firstName?:       string;
    lastName?:        string;
    occupation?:      string;
    publicIdentifier?: string;
  }>;
}

// ── Étape 1 : obtenir le CSRF token (= JSESSIONID sans guillemets) ────────────
async function getCsrfToken(liAt: string): Promise<string | null> {
  try {
    const res = await fetch("https://www.linkedin.com/", {
      headers: {
        Cookie:           `li_at=${liAt}`,
        "User-Agent":     "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
      redirect: "follow",
      signal:   AbortSignal.timeout(6_000),
    });

    // JSESSIONID est dans Set-Cookie, format : JSESSIONID="ajax:1234567890"
    const setCookie = res.headers.get("set-cookie") ?? "";
    const m = setCookie.match(/JSESSIONID="([^"]+)"/);
    if (m) return `ajax:${m[1].replace(/^ajax:/, "")}`;

    // Fallback : chercher dans tous les headers
    const raw = res.headers.get("set-cookie") ?? "";
    const m2 = raw.match(/JSESSIONID="([^"]+)"/);
    return m2 ? `ajax:${m2[1].replace(/^ajax:/, "")}` : null;
  } catch {
    return null;
  }
}

// ── Étape 2 : recherche Voyager ───────────────────────────────────────────────
async function voyagerSearch(
  liAt: string,
  csrf: string,
  keywords: string,
): Promise<{ url: string; firstName: string; lastName: string; headline: string; location: string } | null> {
  const params = new URLSearchParams({
    keywords,
    origin:  "SWITCH_SEARCH_VERTICAL",
    q:       "all",
    start:   "0",
    count:   "5",
    filters: "List(resultType->PEOPLE)",
  });

  try {
    const res = await fetch(
      `https://www.linkedin.com/voyager/api/search/blended?${params}`,
      {
        headers: {
          Cookie:              `li_at=${liAt}; JSESSIONID="${csrf}"`,
          "csrf-token":        csrf,
          "User-Agent":        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept":            "application/vnd.linkedin.normalized+json+2.1",
          "Accept-Language":   "fr-FR,fr;q=0.9",
          "x-li-lang":         "fr_FR",
          "x-li-page-instance":"urn:li:page:d_flagship3_search_srp_people",
          "x-restli-protocol-version": "2.0.0",
        },
        signal: AbortSignal.timeout(8_000),
      },
    );

    if (!res.ok) {
      console.warn("[linkedin-search] voyager status:", res.status);
      return null;
    }

    const json = await res.json() as VoyagerResponse;

    // Extraire depuis `included` (format le plus courant)
    if (json.included?.length) {
      const profiles = json.included.filter(
        (x) => x.$type === "com.linkedin.voyager.identity.shared.MiniProfile" && x.publicIdentifier,
      );
      if (profiles.length > 0) {
        const p = profiles[0];
        return {
          url:       `https://www.linkedin.com/in/${p.publicIdentifier}`,
          firstName: p.firstName ?? "",
          lastName:  p.lastName  ?? "",
          headline:  p.occupation ?? "",
          location:  "",
        };
      }
    }

    // Fallback : extraire depuis data.elements (ancien format)
    const clusters = json.data?.elements ?? [];
    for (const cluster of clusters) {
      for (const el of cluster.elements ?? []) {
        const sp = el.hitInfo?.["com.linkedin.voyager.search.SearchProfile"];
        if (sp?.miniProfile?.publicIdentifier) {
          const mp = sp.miniProfile;
          return {
            url:       `https://www.linkedin.com/in/${mp.publicIdentifier}`,
            firstName: mp.firstName,
            lastName:  mp.lastName,
            headline:  sp.headline ?? mp.occupation ?? "",
            location:  sp.location ?? "",
          };
        }
      }
    }

    return null;
  } catch (err) {
    console.error("[linkedin-search] voyager error:", err);
    return null;
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const liAt = process.env.LINKEDIN_COOKIE;
  if (!liAt) {
    return NextResponse.json(
      { error: "LINKEDIN_COOKIE non configuré (valeur du cookie li_at requis)" },
      { status: 503 },
    );
  }

  const { name, company, location } = await req.json() as {
    name:      string;   // prénom + nom du dirigeant
    company?:  string;   // nom de l'entreprise
    location?: string;   // ville (optionnel)
  };

  if (!name) {
    return NextResponse.json({ error: "name requis" }, { status: 400 });
  }

  // Tronquer le nom légal SIRENE à 2 mots max (prénom + nom)
  // Ex: "LAURENT JEAN JACQUES ALAIN GIRAUD" → "LAURENT JEAN"
  const nameShort = name.trim().split(/\s+/).slice(0, 2).join(" ");

  // Construire les mots-clés : nom court + entreprise (sans ville pour éviter le bruit)
  const parts = [nameShort, company].filter(Boolean);
  const keywords = parts.join(" ");

  // Construire l'URL de recherche LinkedIn (fallback si API échoue)
  // Note: s'ouvre dans le navigateur de l'utilisateur — suggérer d'utiliser le compte dédié
  const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`;

  try {
    // ── Stratégie 1 : Apify (si APIFY_TOKEN configuré) ───────────────────────
    if (process.env.APIFY_TOKEN) {
      try {
        const apifyRes = await fetch(new URL("/api/apify/linkedin", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"), {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ name, company, location }),
          signal:  AbortSignal.timeout(55_000),
        });
        if (apifyRes.ok) {
          const apifyData = await apifyRes.json() as { profile?: unknown; searchUrl?: string; source?: string };
          if (apifyData.profile) {
            return NextResponse.json({ ...apifyData, source: "apify" });
          }
        }
      } catch {
        console.warn("[linkedin-search] Apify fallback to Voyager");
      }
    }

    // ── Stratégie 2 : Voyager API (fallback) ─────────────────────────────────
    const csrf = await getCsrfToken(liAt);
    if (!csrf) {
      return NextResponse.json({ profile: null, searchUrl, warning: "CSRF introuvable — cookie expiré ?", source: "voyager" });
    }

    const profile = await voyagerSearch(liAt, csrf, keywords);
    return NextResponse.json({ profile, searchUrl, source: "voyager" });
  } catch (err) {
    console.error("[linkedin-search]", err);
    return NextResponse.json({ profile: null, searchUrl, error: String(err) });
  }
}
