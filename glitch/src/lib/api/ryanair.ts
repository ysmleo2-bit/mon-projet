/**
 * Client Ryanair public API — aucune clé requise.
 * Retourne de vrais prix en temps réel avec des liens directs vers la page de réservation.
 */

const RYANAIR_BASE = "https://www.ryanair.com/api/farfnd/3";

export interface RyanairFare {
  outbound: {
    departureAirport: {
      iataCode: string;
      name:     string;
      city:     { name: string; code: string; countryCode: string };
    };
    arrivalAirport: {
      iataCode: string;
      name:     string;
      city:     { name: string; code: string; countryCode: string };
    };
    departureDate:  string;
    arrivalDate:    string;
    price:          { value: number; currencyCode: string };
    flightNumber:   string;
    previousPrice:  { value: number } | null;
  };
  summary: {
    price:         { value: number };
    previousPrice: { value: number } | null;
    newRoute:      boolean;
  };
}

// Prix de référence typiques (3-6 mois à l'avance, hors promo) par route
// Basés sur les prix habituels Ryanair observés sur ces routes
const REFERENCE_PRICES: Record<string, number> = {
  // Depuis Paris Beauvais
  "BVA-BFS": 89,   "BVA-BHX": 79,   "BVA-CLJ": 95,   "BVA-CPH": 125,
  "BVA-ORK": 85,   "BVA-IAS": 90,   "BVA-MAN": 84,   "BVA-BGY": 92,
  "BVA-MXP": 98,   "BVA-EDI": 95,   "BVA-DUB": 82,   "BVA-PRG": 85,
  "BVA-VIE": 95,   "BVA-BCN": 78,   "BVA-MAD": 85,   "BVA-FCO": 105,
  "BVA-CIA": 98,   "BVA-LIS": 92,   "BVA-LPL": 80,   "BVA-BRS": 78,
  "BVA-STN": 60,   "BVA-LTN": 58,   "BVA-SXF": 82,   "BVA-GDN": 88,
  "BVA-WRO": 85,   "BVA-POZ": 88,   "BVA-WAW": 90,   "BVA-KRK": 88,
  "BVA-ATH": 110,  "BVA-SKG": 112,  "BVA-BUD": 92,   "BVA-OTP": 95,
  // Depuis Londres Stansted
  "STN-EDI": 52,   "STN-GLA": 58,   "STN-DUB": 72,   "STN-BCN": 92,
  "STN-MAD": 95,   "STN-FCO": 92,   "STN-CIA": 88,   "STN-BGY": 88,
  "STN-VCE": 90,   "STN-NAP": 95,   "STN-BUD": 82,   "STN-PRG": 80,
  "STN-WAW": 88,   "STN-KRK": 85,   "STN-ATH": 108,  "STN-LIS": 92,
  "STN-SZZ": 90,
  // Depuis Dublin
  "DUB-BCN": 88,   "DUB-MAD": 90,   "DUB-FCO": 95,   "DUB-MXP": 92,
  "DUB-GVA": 90,   "DUB-CPH": 105,  "DUB-BUD": 82,   "DUB-PRG": 80,
  // Depuis Barcelone
  "BCN-STN": 90,   "BCN-LGW": 88,   "BCN-MAN": 92,   "BCN-EDI": 95,
  "BCN-DUB": 88,
};

const DEFAULT_REFERENCE = 90;

const COUNTRY_FLAG: Record<string, string> = {
  gb: "🇬🇧", ie: "🇮🇪", es: "🇪🇸", it: "🇮🇹", pt: "🇵🇹", de: "🇩🇪",
  fr: "🇫🇷", nl: "🇳🇱", be: "🇧🇪", at: "🇦🇹", pl: "🇵🇱", ro: "🇷🇴",
  hu: "🇭🇺", cz: "🇨🇿", sk: "🇸🇰", hr: "🇭🇷", bg: "🇧🇬", gr: "🇬🇷",
  el: "🇬🇷", dk: "🇩🇰", se: "🇸🇪", no: "🇳🇴", fi: "🇫🇮", is: "🇮🇸",
  mt: "🇲🇹", cy: "🇨🇾", tr: "🇹🇷", ma: "🇲🇦", tn: "🇹🇳", ua: "🇺🇦",
  il: "🇮🇱", jo: "🇯🇴",
};

export function getFlag(countryCode: string): string {
  return COUNTRY_FLAG[countryCode.toLowerCase()] ?? "🏳️";
}

export function getReferencePrice(from: string, to: string): number {
  return REFERENCE_PRICES[`${from}-${to}`] ?? DEFAULT_REFERENCE;
}

/** Lien direct vers la page de sélection Ryanair — s'ouvre sur la page de réservation avec prix */
export function ryanairBookingUrl(from: string, to: string, date: string): string {
  const params = new URLSearchParams({
    adults:      "1", teens: "0", children: "0", infants: "0",
    dateOut:     date,
    isReturn:    "false",
    discount:    "0",
    promoCode:   "",
    originIata:      from,
    destinationIata: to,
  });
  return `https://www.ryanair.com/fr/fr/trip/flights/select?${params.toString()}`;
}

/** Récupère les tarifs les moins chers depuis un aéroport donné pour les 4 prochains mois */
export async function getCheapFares(departureIata: string): Promise<RyanairFare[]> {
  const now      = new Date();
  const dateFrom = new Date(now); dateFrom.setDate(now.getDate() + 7);
  const dateTo   = new Date(now); dateTo.setDate(now.getDate() + 120);
  const fmt      = (d: Date) => d.toISOString().slice(0, 10);

  const url = `${RYANAIR_BASE}/oneWayFares?` + new URLSearchParams({
    departureAirportIataCode: departureIata,
    language:                 "en",
    limit:                    "50",
    market:                   "en-gb",
    offset:                   "0",
    outboundDepartureDateFrom: fmt(dateFrom),
    outboundDepartureDateTo:   fmt(dateTo),
  }).toString();

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
    next: { revalidate: 1800 },
  });

  if (!res.ok) return [];
  const data = await res.json();
  return data.fares ?? [];
}
