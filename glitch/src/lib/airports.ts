/**
 * Base des aéroports supportés.
 * liveData: true → données temps réel via Ryanair (sans clé)
 * liveData: false → liens Kayak fonctionnels (prix réels sur Kayak)
 */

export interface Airport {
  code:        string;
  name:        string;
  city:        string;
  country:     string;
  countryCode: string;
  flag:        string;
  liveData:    boolean;  // Ryanair data disponible sans clé
  region:      string;
}

export const AIRPORTS: Airport[] = [
  // ── France ──────────────────────────────────────────────────────────────
  { code: "BVA", name: "Paris Beauvais",      city: "Paris",      country: "France",      countryCode: "fr", flag: "🇫🇷", liveData: true,  region: "France" },
  { code: "CDG", name: "Paris Charles de Gaulle", city: "Paris",  country: "France",      countryCode: "fr", flag: "🇫🇷", liveData: false, region: "France" },
  { code: "ORY", name: "Paris Orly",          city: "Paris",      country: "France",      countryCode: "fr", flag: "🇫🇷", liveData: false, region: "France" },
  { code: "LYS", name: "Lyon Saint-Exupéry",  city: "Lyon",       country: "France",      countryCode: "fr", flag: "🇫🇷", liveData: true,  region: "France" },
  { code: "MRS", name: "Marseille Provence",  city: "Marseille",  country: "France",      countryCode: "fr", flag: "🇫🇷", liveData: true,  region: "France" },
  { code: "NCE", name: "Nice Côte d'Azur",    city: "Nice",       country: "France",      countryCode: "fr", flag: "🇫🇷", liveData: true,  region: "France" },
  { code: "NTE", name: "Nantes Atlantique",   city: "Nantes",     country: "France",      countryCode: "fr", flag: "🇫🇷", liveData: true,  region: "France" },
  { code: "BOD", name: "Bordeaux Mérignac",   city: "Bordeaux",   country: "France",      countryCode: "fr", flag: "🇫🇷", liveData: true,  region: "France" },
  { code: "TLS", name: "Toulouse Blagnac",    city: "Toulouse",   country: "France",      countryCode: "fr", flag: "🇫🇷", liveData: true,  region: "France" },
  // ── Royaume-Uni ──────────────────────────────────────────────────────────
  { code: "STN", name: "Londres Stansted",    city: "Londres",    country: "Royaume-Uni", countryCode: "gb", flag: "🇬🇧", liveData: true,  region: "Europe du Nord" },
  { code: "LGW", name: "Londres Gatwick",     city: "Londres",    country: "Royaume-Uni", countryCode: "gb", flag: "🇬🇧", liveData: true,  region: "Europe du Nord" },
  { code: "LHR", name: "Londres Heathrow",    city: "Londres",    country: "Royaume-Uni", countryCode: "gb", flag: "🇬🇧", liveData: false, region: "Europe du Nord" },
  { code: "MAN", name: "Manchester",          city: "Manchester", country: "Royaume-Uni", countryCode: "gb", flag: "🇬🇧", liveData: true,  region: "Europe du Nord" },
  { code: "EDI", name: "Edinburgh",           city: "Edinburgh",  country: "Royaume-Uni", countryCode: "gb", flag: "🇬🇧", liveData: true,  region: "Europe du Nord" },
  // ── Espagne ──────────────────────────────────────────────────────────────
  { code: "BCN", name: "Barcelone El Prat",   city: "Barcelone",  country: "Espagne",     countryCode: "es", flag: "🇪🇸", liveData: true,  region: "Europe du Sud" },
  { code: "MAD", name: "Madrid Barajas",      city: "Madrid",     country: "Espagne",     countryCode: "es", flag: "🇪🇸", liveData: true,  region: "Europe du Sud" },
  { code: "AGP", name: "Málaga",              city: "Málaga",     country: "Espagne",     countryCode: "es", flag: "🇪🇸", liveData: true,  region: "Europe du Sud" },
  { code: "PMI", name: "Palma de Majorque",   city: "Majorque",   country: "Espagne",     countryCode: "es", flag: "🇪🇸", liveData: true,  region: "Europe du Sud" },
  // ── Italie ───────────────────────────────────────────────────────────────
  { code: "BGY", name: "Milan Bergamo",       city: "Milan",      country: "Italie",      countryCode: "it", flag: "🇮🇹", liveData: true,  region: "Europe du Sud" },
  { code: "MXP", name: "Milan Malpensa",      city: "Milan",      country: "Italie",      countryCode: "it", flag: "🇮🇹", liveData: false, region: "Europe du Sud" },
  { code: "CIA", name: "Rome Ciampino",       city: "Rome",       country: "Italie",      countryCode: "it", flag: "🇮🇹", liveData: true,  region: "Europe du Sud" },
  { code: "FCO", name: "Rome Fiumicino",      city: "Rome",       country: "Italie",      countryCode: "it", flag: "🇮🇹", liveData: false, region: "Europe du Sud" },
  // ── Allemagne ────────────────────────────────────────────────────────────
  { code: "BER", name: "Berlin Brandenburg",  city: "Berlin",     country: "Allemagne",   countryCode: "de", flag: "🇩🇪", liveData: true,  region: "Europe Centrale" },
  { code: "FRA", name: "Francfort",           city: "Francfort",  country: "Allemagne",   countryCode: "de", flag: "🇩🇪", liveData: false, region: "Europe Centrale" },
  { code: "MUC", name: "Munich",              city: "Munich",     country: "Allemagne",   countryCode: "de", flag: "🇩🇪", liveData: false, region: "Europe Centrale" },
  // ── Autres pays ──────────────────────────────────────────────────────────
  { code: "DUB", name: "Dublin",              city: "Dublin",     country: "Irlande",     countryCode: "ie", flag: "🇮🇪", liveData: true,  region: "Europe du Nord" },
  { code: "AMS", name: "Amsterdam Schiphol",  city: "Amsterdam",  country: "Pays-Bas",    countryCode: "nl", flag: "🇳🇱", liveData: false, region: "Europe Centrale" },
  { code: "BRU", name: "Bruxelles",           city: "Bruxelles",  country: "Belgique",    countryCode: "be", flag: "🇧🇪", liveData: true,  region: "Europe Centrale" },
  { code: "LIS", name: "Lisbonne",            city: "Lisbonne",   country: "Portugal",    countryCode: "pt", flag: "🇵🇹", liveData: true,  region: "Europe du Sud" },
  { code: "OPO", name: "Porto",               city: "Porto",      country: "Portugal",    countryCode: "pt", flag: "🇵🇹", liveData: true,  region: "Europe du Sud" },
  { code: "ATH", name: "Athènes",             city: "Athènes",    country: "Grèce",       countryCode: "gr", flag: "🇬🇷", liveData: true,  region: "Europe du Sud" },
  { code: "VIE", name: "Vienne",              city: "Vienne",     country: "Autriche",    countryCode: "at", flag: "🇦🇹", liveData: true,  region: "Europe Centrale" },
  { code: "PRG", name: "Prague",              city: "Prague",     country: "Rép. Tchèque",countryCode: "cz", flag: "🇨🇿", liveData: true,  region: "Europe Centrale" },
  { code: "BUD", name: "Budapest",            city: "Budapest",   country: "Hongrie",     countryCode: "hu", flag: "🇭🇺", liveData: true,  region: "Europe Centrale" },
  { code: "WAW", name: "Varsovie",            city: "Varsovie",   country: "Pologne",     countryCode: "pl", flag: "🇵🇱", liveData: true,  region: "Europe Centrale" },
  { code: "CPH", name: "Copenhague",          city: "Copenhague", country: "Danemark",    countryCode: "dk", flag: "🇩🇰", liveData: true,  region: "Europe du Nord" },
  { code: "OSL", name: "Oslo Gardermoen",     city: "Oslo",       country: "Norvège",     countryCode: "no", flag: "🇳🇴", liveData: true,  region: "Europe du Nord" },
  { code: "ARN", name: "Stockholm Arlanda",   city: "Stockholm",  country: "Suède",       countryCode: "se", flag: "🇸🇪", liveData: true,  region: "Europe du Nord" },
];

export const AIRPORTS_BY_CODE = Object.fromEntries(AIRPORTS.map(a => [a.code, a]));

// Aéroports avec données live Ryanair (pour l'API)
export const LIVE_AIRPORTS = AIRPORTS.filter(a => a.liveData).map(a => a.code);

export function getAirport(code: string): Airport | undefined {
  return AIRPORTS_BY_CODE[code];
}

// Groupement par région pour l'affichage
export const REGIONS = ["France", "Europe du Nord", "Europe du Sud", "Europe Centrale"] as const;
export type Region = typeof REGIONS[number];

export function airportsByRegion(region: Region): Airport[] {
  return AIRPORTS.filter(a => a.region === region);
}
