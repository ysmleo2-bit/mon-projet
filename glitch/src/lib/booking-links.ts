/**
 * Génère des liens de réservation profonds vers Kayak, Google Flights et Skyscanner.
 * Kayak est privilégié car son format URL est stable et ouvre directement les résultats
 * filtrés par route, date et cabine — sans redirections intermédiaires.
 */

type Cabin = "economy" | "business" | "first" | "premium_economy";

const KAYAK_CABIN: Record<Cabin, string> = {
  economy:          "e",
  premium_economy:  "p",
  business:         "b",
  first:            "f",
};

function yymmdd(iso: string): string {
  // "2025-07-14" → "2025-07-14" (Kayak accepts YYYY-MM-DD)
  return iso.slice(0, 10);
}

export function kayakLink(params: {
  from: string;
  to: string;
  departDate: string;
  returnDate?: string;
  cabin?: Cabin;
  adults?: number;
}): string {
  const { from, to, departDate, returnDate, cabin = "economy", adults = 1 } = params;
  const cabinCode = KAYAK_CABIN[cabin] ?? "e";
  const depart    = yymmdd(departDate);

  const base = returnDate
    ? `https://www.kayak.fr/flights/${from}-${to}/${depart}/${yymmdd(returnDate)}`
    : `https://www.kayak.fr/flights/${from}-${to}/${depart}`;

  const query = new URLSearchParams({
    sort:   "price_a",
    cabin:  cabinCode,
    adults: String(adults),
    ...(returnDate ? {} : { oneway: "y" }),
  });

  return `${base}?${query.toString()}`;
}

export function googleFlightsLink(params: {
  from: string;
  to: string;
  departDate: string;
  returnDate?: string;
  cabin?: Cabin;
}): string {
  const { from, to, departDate, returnDate, cabin = "economy" } = params;
  const query = new URLSearchParams({
    q: `Flights from ${from} to ${to} on ${departDate}${returnDate ? ` return ${returnDate}` : ""}`,
  });
  return `https://www.google.com/travel/flights?${query.toString()}`;
}

export function skyscannerLink(params: {
  from: string;
  to: string;
  departDate: string;
  returnDate?: string;
  cabin?: Cabin;
}): string {
  const { from, to, departDate, returnDate, cabin = "economy" } = params;
  // Skyscanner: YYMMDD format
  function toSS(iso: string) {
    const d = iso.slice(0, 10).replace(/-/g, "");
    return d.slice(2); // YYYYMMDD → YYMMDD
  }
  const path = returnDate
    ? `/transport/vols/${from.toLowerCase()}/${to.toLowerCase()}/${toSS(departDate)}/${toSS(returnDate)}/`
    : `/transport/vols/${from.toLowerCase()}/${to.toLowerCase()}/${toSS(departDate)}/`;
  const q = new URLSearchParams({ adults: "1", cabinclass: cabin });
  return `https://www.skyscanner.fr${path}?${q.toString()}`;
}
