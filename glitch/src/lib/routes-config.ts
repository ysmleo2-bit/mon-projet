/**
 * Routes surveillées par le moteur GLITCH.
 * normalPrice = prix médian observé sur 30 jours (en EUR, aller simple ou A/R selon roundTrip).
 * Ces valeurs servent de référence pour calculer la déviation et scorer les deals.
 */

export interface MonitoredRoute {
  from:        string;  // IATA
  to:          string;  // IATA
  fromCity:    string;
  toCity:      string;
  flag:        string;
  cabin:       "economy" | "business" | "first";
  normalPrice: number;  // EUR, référence 30j
  avg7d:       number;  // légèrement différent (tendance récente)
  lowestEver:  number;
  stops:       number;  // typique
  airlines:    string[]; // compagnies qui opèrent cette route
}

export const MONITORED_ROUTES: MonitoredRoute[] = [
  // ─── Depuis Paris CDG ────────────────────────────────────────────────────
  { from: "CDG", to: "JFK", fromCity: "Paris", toCity: "New York",       flag: "🇺🇸", cabin: "economy",  normalPrice: 520,  avg7d: 495,  lowestEver: 280, stops: 0, airlines: ["AF","DL","AA","UA"] },
  { from: "CDG", to: "JFK", fromCity: "Paris", toCity: "New York",       flag: "🇺🇸", cabin: "business", normalPrice: 3200, avg7d: 3100, lowestEver: 1800, stops: 0, airlines: ["AF","DL"] },
  { from: "CDG", to: "NRT", fromCity: "Paris", toCity: "Tokyo",          flag: "🇯🇵", cabin: "economy",  normalPrice: 820,  avg7d: 800,  lowestEver: 430, stops: 1, airlines: ["AF","JL","ANA"] },
  { from: "CDG", to: "NRT", fromCity: "Paris", toCity: "Tokyo",          flag: "🇯🇵", cabin: "business", normalPrice: 4500, avg7d: 4200, lowestEver: 2200, stops: 1, airlines: ["AF","JL"] },
  { from: "CDG", to: "BKK", fromCity: "Paris", toCity: "Bangkok",        flag: "🇹🇭", cabin: "economy",  normalPrice: 520,  avg7d: 490,  lowestEver: 310, stops: 1, airlines: ["TG","AF","EK"] },
  { from: "CDG", to: "LAX", fromCity: "Paris", toCity: "Los Angeles",    flag: "🇺🇸", cabin: "economy",  normalPrice: 680,  avg7d: 650,  lowestEver: 380, stops: 0, airlines: ["AF","AA"] },
  { from: "CDG", to: "DXB", fromCity: "Paris", toCity: "Dubaï",          flag: "🇦🇪", cabin: "economy",  normalPrice: 380,  avg7d: 360,  lowestEver: 180, stops: 0, airlines: ["EK","AF","FZ"] },
  { from: "CDG", to: "DXB", fromCity: "Paris", toCity: "Dubaï",          flag: "🇦🇪", cabin: "first",    normalPrice: 6500, avg7d: 6200, lowestEver: 3800, stops: 0, airlines: ["EK"] },
  { from: "CDG", to: "SYD", fromCity: "Paris", toCity: "Sydney",         flag: "🇦🇺", cabin: "economy",  normalPrice: 1350, avg7d: 1300, lowestEver: 780, stops: 1, airlines: ["QF","EK","AF"] },
  { from: "CDG", to: "SYD", fromCity: "Paris", toCity: "Sydney",         flag: "🇦🇺", cabin: "business", normalPrice: 6800, avg7d: 6500, lowestEver: 3500, stops: 1, airlines: ["QF","EK"] },
  { from: "CDG", to: "MEX", fromCity: "Paris", toCity: "Mexico City",    flag: "🇲🇽", cabin: "economy",  normalPrice: 720,  avg7d: 700,  lowestEver: 420, stops: 1, airlines: ["AF","AM","IB"] },
  { from: "CDG", to: "GRU", fromCity: "Paris", toCity: "São Paulo",      flag: "🇧🇷", cabin: "economy",  normalPrice: 780,  avg7d: 760,  lowestEver: 490, stops: 0, airlines: ["AF","LA"] },
  { from: "CDG", to: "MIA", fromCity: "Paris", toCity: "Miami",          flag: "🇺🇸", cabin: "economy",  normalPrice: 460,  avg7d: 440,  lowestEver: 260, stops: 0, airlines: ["AF","AA"] },
  { from: "CDG", to: "ICN", fromCity: "Paris", toCity: "Séoul",          flag: "🇰🇷", cabin: "economy",  normalPrice: 780,  avg7d: 750,  lowestEver: 410, stops: 0, airlines: ["KE","OZ","AF"] },
  { from: "CDG", to: "SIN", fromCity: "Paris", toCity: "Singapour",      flag: "🇸🇬", cabin: "economy",  normalPrice: 680,  avg7d: 650,  lowestEver: 390, stops: 0, airlines: ["SQ","AF"] },
  { from: "CDG", to: "HKG", fromCity: "Paris", toCity: "Hong Kong",      flag: "🇭🇰", cabin: "economy",  normalPrice: 650,  avg7d: 620,  lowestEver: 360, stops: 1, airlines: ["CX","AF","EK"] },
  { from: "CDG", to: "YUL", fromCity: "Paris", toCity: "Montréal",       flag: "🇨🇦", cabin: "economy",  normalPrice: 420,  avg7d: 400,  lowestEver: 220, stops: 0, airlines: ["AF","AC"] },
  { from: "CDG", to: "BCN", fromCity: "Paris", toCity: "Barcelone",      flag: "🇪🇸", cabin: "economy",  normalPrice: 110,  avg7d: 100,  lowestEver: 35,  stops: 0, airlines: ["VY","FR","AF"] },

  // ─── Depuis Londres LHR ──────────────────────────────────────────────────
  { from: "LHR", to: "JFK", fromCity: "Londres", toCity: "New York",     flag: "🇺🇸", cabin: "economy",  normalPrice: 480,  avg7d: 460,  lowestEver: 260, stops: 0, airlines: ["BA","AA","VS","UA"] },
  { from: "LHR", to: "SYD", fromCity: "Londres", toCity: "Sydney",       flag: "🇦🇺", cabin: "economy",  normalPrice: 980,  avg7d: 950,  lowestEver: 540, stops: 1, airlines: ["QF","EK","BA"] },
  { from: "LHR", to: "DXB", fromCity: "Londres", toCity: "Dubaï",        flag: "🇦🇪", cabin: "economy",  normalPrice: 320,  avg7d: 310,  lowestEver: 150, stops: 0, airlines: ["EK","BA","FZ"] },

  // ─── Depuis Amsterdam AMS ────────────────────────────────────────────────
  { from: "AMS", to: "DPS", fromCity: "Amsterdam", toCity: "Bali",       flag: "🇮🇩", cabin: "economy",  normalPrice: 820,  avg7d: 800,  lowestEver: 490, stops: 1, airlines: ["KL","GA"] },
  { from: "AMS", to: "JFK", fromCity: "Amsterdam", toCity: "New York",   flag: "🇺🇸", cabin: "economy",  normalPrice: 460,  avg7d: 440,  lowestEver: 250, stops: 0, airlines: ["KL","DL","UA"] },

  // ─── Depuis Madrid MAD ───────────────────────────────────────────────────
  { from: "MAD", to: "MIA", fromCity: "Madrid", toCity: "Miami",         flag: "🇺🇸", cabin: "economy",  normalPrice: 470,  avg7d: 450,  lowestEver: 280, stops: 0, airlines: ["IB","AA","UX"] },
  { from: "MAD", to: "JFK", fromCity: "Madrid", toCity: "New York",      flag: "🇺🇸", cabin: "economy",  normalPrice: 440,  avg7d: 420,  lowestEver: 250, stops: 0, airlines: ["IB","AA"] },

  // ─── Depuis Rome FCO ─────────────────────────────────────────────────────
  { from: "FCO", to: "JFK", fromCity: "Rome", toCity: "New York",        flag: "🇺🇸", cabin: "economy",  normalPrice: 540,  avg7d: 520,  lowestEver: 310, stops: 0, airlines: ["AZ","AA","UA"] },
];
