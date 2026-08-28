/**
 * POST /api/prospection/search-maps
 *
 * Recherche de prospects via Google Maps (Apify compass/google-maps-scraper).
 * Contrairement à SIRENE, Google Business a des téléphones sur ~85 % des entreprises.
 *
 * Différences avec /api/apify/maps :
 *  - Retourne des Prospect[] (format Prospection) plutôt que des Lead[]
 *  - Conserve TOUTES les entreprises (même sans tél) — pas de filtrage agressif
 *  - Calcule le statut ouvert/fermé en temps réel depuis les horaires
 *  - Sauvegarde en DB pour le suivi commercial
 *  - Fetch jusqu'à 3× le quota pour absorber les résultats fermés/non-pertinents
 *
 * Body : { searchQuery, departement?, maxResults?, requirePhone? }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { runApifyActor, ApifyError } from "@/lib/apify";
import type { Prospect, ProspectAction } from "@/lib/types-prospection";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

const ACTOR_ID = "compass/google-maps-scraper";

// ── Types Apify ───────────────────────────────────────────────────────────────
interface ApifyPlace {
  title?:             string;
  name?:              string;
  categoryName?:      string;
  address?:           string;
  city?:              string;
  postalCode?:        string;
  countryCode?:       string;
  phone?:             string;
  phoneUnformatted?:  string;
  website?:           string;
  url?:               string;
  totalScore?:        number;
  reviewsCount?:      number;
  permanentlyClosed?: boolean;
  temporarilyClosed?: boolean;
  location?: { lat?: number; lng?: number };
  openingHours?: Array<{ day: string; hours: string }>;
  priceRange?:        string;
  googleMapsUrl?:     string;
  placeId?:           string;
}

// ── Calcul statut ouvert/fermé ────────────────────────────────────────────────
// Jours en français (Google Maps renvoie parfois FR, parfois EN)
const DAY_INDEX: Record<string, number> = {
  "lundi": 1, "monday": 1,
  "mardi": 2, "tuesday": 2,
  "mercredi": 3, "wednesday": 3,
  "jeudi": 4, "thursday": 4,
  "vendredi": 5, "friday": 5,
  "samedi": 6, "saturday": 6,
  "dimanche": 0, "sunday": 0,
};

function parseHour(s: string): number {
  // "08:00", "8h00", "8h", "8:00 AM", "8 AM"
  const m = s.trim().match(/^(\d{1,2})[:h]?(\d{0,2})\s*(am|pm)?$/i);
  if (!m) return -1;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const pm  = m[3]?.toLowerCase() === "pm";
  if (pm && h < 12) h += 12;
  if (!pm && m[3]?.toLowerCase() === "am" && h === 12) h = 0;
  return h * 60 + min;
}

function computeOpenStatus(hours: string[]): {
  isOpen: boolean | null;
  label: string;
} {
  if (!hours || hours.length === 0) return { isOpen: null, label: "" };
  const now     = new Date();
  const dayOfWk = now.getDay(); // 0=Sun, 1=Mon…
  const nowMin  = now.getHours() * 60 + now.getMinutes();

  for (const line of hours) {
    // "Lundi: 08:00–18:00" or "Monday: 08:00-18:00"
    const sep = line.indexOf(":");
    if (sep === -1) continue;
    const day  = line.slice(0, sep).trim().toLowerCase();
    const rest = line.slice(sep + 1).trim();

    const dayIdx = DAY_INDEX[day];
    if (dayIdx === undefined || dayIdx !== dayOfWk) continue;

    if (/ferm|closed|24h|24\/7/i.test(rest)) {
      if (/24h|24\/7/i.test(rest)) return { isOpen: true, label: "Ouvert 24h/24" };
      return { isOpen: false, label: "Fermé aujourd'hui" };
    }

    // Plage "08:00–18:00" or "08:00-18:00"
    const range = rest.split(/[–\-–]/);
    if (range.length < 2) continue;
    const open  = parseHour(range[0]);
    const close = parseHour(range[1]);
    if (open === -1 || close === -1) continue;

    const isOpen = nowMin >= open && nowMin < close;
    if (isOpen) {
      const closeH = Math.floor(close / 60).toString().padStart(2, "0");
      const closeM = (close % 60).toString().padStart(2, "0");
      return { isOpen: true, label: `Ouvert jusqu'à ${closeH}:${closeM}` };
    } else if (nowMin < open) {
      const openH = Math.floor(open / 60).toString().padStart(2, "0");
      const openM = (open % 60).toString().padStart(2, "0");
      return { isOpen: false, label: `Ouvre à ${openH}:${openM}` };
    } else {
      return { isOpen: false, label: "Fermé" };
    }
  }
  return { isOpen: null, label: "" };
}

// ── Normalisation tél FR ──────────────────────────────────────────────────────
function normalizePhone(raw?: string): string | undefined {
  if (!raw) return undefined;
  let p = raw.replace(/[\s.\-]/g, "");
  if (p.startsWith("+33")) p = "0" + p.slice(3);
  if (p.startsWith("0033")) p = "0" + p.slice(4);
  if (p.length === 10 && /^0[1-9]/.test(p)) {
    return p.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4 $5");
  }
  return raw.trim() || undefined;
}

function phoneType(p: string): "mobile" | "fixe" | "inconnu" {
  const d = p.replace(/\s/g, "");
  if (/^0[67]/.test(d)) return "mobile";
  if (/^0[1-589]/.test(d)) return "fixe";
  return "inconnu";
}

// ── Mots à retirer de la query pour le matching catégorie ─────────────────────
function normalize(s: string) {
  return s.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

// ── Conversion Apify → Prospect ───────────────────────────────────────────────
function apifyToProspect(p: ApifyPlace, secteur: string, user: { userId: string; name: string } | null): Prospect {
  const now     = new Date().toISOString();
  const name    = p.title ?? p.name ?? "Inconnu";
  const phone   = normalizePhone(p.phone ?? p.phoneUnformatted);
  const hours   = (p.openingHours ?? []).map((h) => `${h.day}: ${h.hours}`);
  const { isOpen, label: hoursLabel } = computeOpenStatus(hours);
  const pType   = phone ? phoneType(phone) : undefined;

  // ID unique basé sur placeId ou nom normalisé
  const uid = p.placeId ?? normalize(name).replace(/\s+/g, "-").slice(0, 40);

  const actions: ProspectAction[] = [{
    date: now, type: "enrichissement",
    detail: `Prospect trouvé via Google Maps — catégorie: ${p.categoryName ?? secteur}`,
  }];

  const siteRaw = p.website?.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return {
    id:           `maps-${uid}`,
    siren:        uid,            // pas de SIREN pour Google Maps → placeId comme identifiant
    nom:          name,
    codeNaf:      "",
    libelleNaf:   p.categoryName ?? secteur,
    secteur,
    adresse:      p.address ?? "",
    ville:        p.city ?? "",
    codePostal:   p.postalCode ?? "",

    telephonePro: phone,
    siteWeb:      siteRaw || undefined,

    // Google Maps specifics
    placeId:           p.placeId,
    googleMapsUrl:     p.googleMapsUrl ?? p.url,
    rating:            p.totalScore,
    reviewCount:       p.reviewsCount,
    openingHours:      hours.length > 0 ? hours : undefined,
    isCurrentlyOpen:   (p.permanentlyClosed || p.temporarilyClosed) ? false : isOpen,
    currentHoursLabel: hoursLabel || undefined,
    searchSource:      "google_maps",

    statut:    phone ? "a_enrichir" : "nouveau",
    sources:   ["google_places"],
    actions,
    createdAt: now,
    updatedAt: now,

    // Auto-attribution au SDR qui lance la recherche
    assignedToId: user?.userId,
    assignedTo:   user?.name,
    dirigeants:   [],
  } as Prospect;
}

// ── Handler principal ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { user, error: authError } = requireAuth(req);
  if (authError) return authError;

  if (!process.env.APIFY_TOKEN) {
    return NextResponse.json({ error: "APIFY_TOKEN non configuré" }, { status: 503 });
  }

  const {
    searchQuery,
    departement,
    maxResults  = 100,
    requirePhone = false,
  } = await req.json() as {
    searchQuery:   string;
    departement?:  string;
    maxResults?:   number;
    requirePhone?: boolean;
  };

  if (!searchQuery) {
    return NextResponse.json({ error: "searchQuery requis" }, { status: 400 });
  }

  // Construire la query Google Maps : "{secteur} {nom_dept}"
  // Ex: "peintre Gironde", "plombier Paris"
  const query = searchQuery.trim();

  // Fetch 3× pour absorber les fermés et non-pertinents
  const fetchCount = Math.min(maxResults * 3, 300);

  try {
    const results = await runApifyActor<ApifyPlace>(
      ACTOR_ID,
      {
        searchStringsArray:           [query],
        maxCrawledPlacesPerSearch:    fetchCount,
        language:                     "fr",
        countryCode:                  "fr",
        includeHistogram:             false,
        includeOpeningHours:          true,
        includePeopleAlsoSearch:      false,
        additionalInfo:               false,
        exportPlaceUrls:              false,
        scrapeDirectories:            false,
        deeperCityScrape:             false,
      },
      Math.ceil(fetchCount / 20) * 20 + 20,
    );

    // ── Pipeline avec compteurs ───────────────────────────────────────────────
    const stats = {
      raw:           results.length,
      permenantlyClosedDropped: 0,
      converted:     0,
      withPhone:     0,
      withSite:      0,
      withRating:    0,
      open:          0,
      closed:        0,
      unknownStatus: 0,
    };

    // Filtre uniquement les fermés définitivement (temporaire = conserver)
    const active = results.filter((p) => {
      if (p.permanentlyClosed) { stats.permenantlyClosedDropped++; return false; }
      return true;
    });

    // Filtre optionnel par département (sur le code postal)
    const deptFiltered = departement
      ? active.filter((p) => {
          if (!p.postalCode) return true; // conserver si pas de CP
          return p.postalCode.startsWith(departement === "75" ? "75" : departement);
        })
      : active;

    // Filtre optionnel "require phone"
    const phoneFiltered = requirePhone
      ? deptFiltered.filter((p) => !!(p.phone ?? p.phoneUnformatted))
      : deptFiltered;

    // Convertir en Prospects
    const prospects = phoneFiltered
      .slice(0, maxResults)
      .map((p) => {
        const prospect = apifyToProspect(p, searchQuery, user);
        stats.converted++;
        if (prospect.telephonePro) stats.withPhone++;
        if (prospect.siteWeb)      stats.withSite++;
        if (prospect.rating)       stats.withRating++;
        if (prospect.isCurrentlyOpen === true)  stats.open++;
        else if (prospect.isCurrentlyOpen === false) stats.closed++;
        else stats.unknownStatus++;
        return prospect;
      });

    // Sauvegarder en DB (merge intelligent)
    try {
      const { dbUpsertProspects } = await import("@/lib/db-prospection");
      await dbUpsertProspects(prospects);
    } catch (dbErr) {
      console.warn("[search-maps] DB save error:", dbErr);
    }

    return NextResponse.json({
      prospects,
      total:  prospects.length,
      stats,
      source: "google_maps",
    });
  } catch (err) {
    if (err instanceof ApifyError) {
      return NextResponse.json({ error: err.message, prospects: [] }, { status: 502 });
    }
    console.error("[prospection/search-maps]", err);
    return NextResponse.json({ error: String(err), prospects: [] }, { status: 500 });
  }
}
