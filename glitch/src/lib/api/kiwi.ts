/**
 * Client Kiwi.com / Tequila API
 *
 * API gratuite : https://tequila.kiwi.com (inscription → clé API)
 * Env requis   : KIWI_API_KEY dans .env.local
 *
 * Chaque résultat contient un champ `deep_link` — c'est l'URL directe
 * vers la page de paiement Kiwi avec le prix affiché verrouillé.
 */

const BASE = "https://tequila.kiwi.com/v2";

export interface KiwiResult {
  id:               string;
  price:            number;
  deep_link:        string;           // ← lien direct vers la réservation au prix affiché
  airlines:         string[];
  flyFrom:          string;
  flyTo:            string;
  cityFrom:         string;
  cityTo:           string;
  countryTo:        { name: string; code: string };
  local_departure:  string;           // ISO
  local_arrival:    string;
  utc_departure:    string;
  utc_arrival:      string;
  nightsInDest:     number | null;
  route:            KiwiSegment[];
  availability:     { seats: number };
  duration:         { departure: number; return: number; total: number };
  bags_price:       Record<string, number>;
}

interface KiwiSegment {
  flyFrom:         string;
  flyTo:           string;
  airline:         string;
  flight_no:       string;
  local_departure: string;
  local_arrival:   string;
}

export interface KiwiSearchParams {
  fly_from:          string;
  fly_to:            string;
  date_from:         string;  // DD/MM/YYYY
  date_to:           string;  // DD/MM/YYYY
  return_from?:      string;
  return_to?:        string;
  adults?:           number;
  selected_cabins?:  "M" | "W" | "C" | "F";  // Economy / Premium Eco / Business / First
  curr?:             string;
  sort?:             "price" | "quality" | "date";
  limit?:            number;
  partner?:          string;
}

function toKiwiDate(iso: string): string {
  // "2025-07-14" → "14/07/2025"
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export const CABIN_CODE: Record<string, "M" | "W" | "C" | "F"> = {
  economy:         "M",
  premium_economy: "W",
  business:        "C",
  first:           "F",
};

/**
 * Recherche les vols les moins chers pour une route donnée.
 * Retourne un tableau de résultats Kiwi triés par prix croissant.
 */
export async function searchFlights(params: KiwiSearchParams): Promise<KiwiResult[]> {
  const apiKey = process.env.KIWI_API_KEY;
  if (!apiKey) throw new Error("KIWI_API_KEY non configurée");

  const qp = new URLSearchParams({
    fly_from:         params.fly_from,
    fly_to:           params.fly_to,
    date_from:        params.date_from,
    date_to:          params.date_to,
    adults:           String(params.adults ?? 1),
    selected_cabins:  params.selected_cabins ?? "M",
    curr:             params.curr ?? "EUR",
    sort:             params.sort ?? "price",
    limit:            String(params.limit ?? 5),
    partner:          params.partner ?? "picky",
    ...(params.return_from ? { return_from: params.return_from } : {}),
    ...(params.return_to   ? { return_to:   params.return_to   } : {}),
  });

  const res = await fetch(`${BASE}/search?${qp.toString()}`, {
    headers: { apikey: apiKey },
    next: { revalidate: 3600 }, // cache 1h côté Next.js
  });

  if (!res.ok) {
    throw new Error(`Kiwi API error ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  return (json.data ?? []) as KiwiResult[];
}

/**
 * Recherche les cheapest deals pour une liste de routes, sur une fenêtre de 90 jours.
 */
export async function searchRouteCheapest(
  from: string,
  to: string,
  cabin: "M" | "W" | "C" | "F" = "M",
): Promise<KiwiResult | null> {
  const start = today();
  const end   = addDays(start, 90);

  const results = await searchFlights({
    fly_from:         from,
    fly_to:           to,
    date_from:        toKiwiDate(start),
    date_to:          toKiwiDate(end),
    selected_cabins:  cabin,
    limit:            1,
    sort:             "price",
  });

  return results[0] ?? null;
}
