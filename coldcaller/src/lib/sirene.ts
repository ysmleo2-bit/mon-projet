/**
 * sirene.ts — Annuaire des Entreprises (api.gouv.fr)
 * Source officielle gratuite : vrais noms + adresses, sans téléphone.
 * On combine avec OSM pour enrichir les téléphones quand disponibles.
 */

import type { Lead } from "@/lib/types";

// ── Mapping niche → codes NAF ──────────────────────────────────────────────
const NICHE_TO_NAF: Record<string, string[]> = {
  Plombier:     ["43.21A","43.22A"],
  Électricien:  ["43.21A","43.21B"],
  Maçon:        ["43.99C","41.20A","43.12A"],
  Serrurier:    ["43.22B","43.32B"],
  Peintre:      ["43.34Z"],
  Couvreur:     ["43.91A","43.91B"],
  Carreleur:    ["43.33Z"],
  Menuisier:    ["43.32A","43.32B","16.23Z"],
  Chauffagiste: ["43.22A","43.22C"],
  Paysagiste:   ["81.30Z"],
  Nettoyage:    ["81.21Z","81.22Z"],
  Restaurant:   ["56.10A","56.10B","56.21Z"],
  Boulangerie:  ["10.71A","10.71B","47.24Z"],
  Coiffeur:     ["96.02A","96.02B"],
  Comptable:    ["69.20Z"],
};

// ── Haversine (km) ─────────────────────────────────────────────────────────
function distKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Résultat brut de l'API ─────────────────────────────────────────────────
interface SireneResult {
  siren: string;
  nom_complet: string;
  nom_raison_sociale?: string;
  siege: {
    siret: string;
    libelle_commune: string;
    numero_voie?: string;
    libelle_voie?: string;
    code_postal?: string;
    latitude?: number;
    longitude?: number;
  };
  activite_principale: string;
}

// Timeout de 8 s par appel pour éviter de bloquer la route
async function fetchPage(
  naf: string,
  dept: string,
  page: number,
): Promise<SireneResult[]> {
  if (!dept) return [];                           // dept vide → on ne filtre pas par dept
  const url =
    `https://recherche-entreprises.api.gouv.fr/search` +
    `?activite_principale=${encodeURIComponent(naf)}` +
    `&departement=${dept}&page=${page}&per_page=25` +
    `&statut_diffusion_etablissement=O`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8_000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": "ColdCaller/1.0" },
    });
    if (!res.ok) return [];
    const json = await res.json() as { results: SireneResult[] };
    return json.results ?? [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// ── Chercher des entreprises via l'Annuaire ────────────────────────────────
export async function searchSirene(
  niche: string,
  dept: string,
  cityLat: number,
  cityLon: number,
  radiusKm: number,
  maxResults = 60,
): Promise<Lead[]> {
  const nafCodes = NICHE_TO_NAF[niche] ?? [];
  if (!nafCodes.length || !dept) return [];

  // Lancer toutes les pages en parallèle (page 1 + 2 par NAF) — max 8 appels simultanés
  const pages: Array<Promise<SireneResult[]>> = [];
  for (const naf of nafCodes) {
    pages.push(fetchPage(naf, dept, 1));
    pages.push(fetchPage(naf, dept, 2));
  }

  const settled = await Promise.all(pages);
  const allResults = settled.flat();

  // Dédupliquer par SIREN
  const seen = new Set<string>();
  const unique = allResults.filter((r) => {
    if (!r?.siren || seen.has(r.siren)) return false;
    seen.add(r.siren);
    return true;
  });

  // Filtrer par distance si coordonnées disponibles
  const inRadius = unique.filter((r) => {
    const lat = r.siege?.latitude;
    const lon = r.siege?.longitude;
    if (!lat || !lon) return true; // garder si pas de coordonnées
    return distKm(cityLat, cityLon, lat, lon) <= radiusKm;
  });

  // Convertir en Lead
  const now = new Date().toISOString();
  return inRadius.slice(0, maxResults).map((r): Lead => {
    const s = r.siege;
    const address = [s.numero_voie, s.libelle_voie].filter(Boolean).join(" ") || "";
    return {
      id:          `sirene-${r.siren}`,
      name:        r.nom_raison_sociale ?? r.nom_complet,
      category:    niche,
      phone:       "",           // pas disponible dans l'Annuaire
      address,
      city:        s.libelle_commune,
      rating:      0,
      reviewCount: 0,
      status:      "new",
      notes:       "",
      source:      "openstreetmap",
      detectedAt:  now,
      callCount:   0,
    };
  });
}
