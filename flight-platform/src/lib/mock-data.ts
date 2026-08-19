import type {
  FlightOffer,
  Hotel,
  PriceAlert,
  CalendarPriceDay,
  Airport,
  Airline,
} from "./types";

export const AIRPORTS: Record<string, Airport> = {
  CDG: { code: "CDG", name: "Charles de Gaulle", city: "Paris", country: "France", lat: 49.009, lon: 2.547 },
  ORY: { code: "ORY", name: "Orly", city: "Paris", country: "France", lat: 48.723, lon: 2.379 },
  LHR: { code: "LHR", name: "Heathrow", city: "Londres", country: "UK", lat: 51.477, lon: -0.461 },
  JFK: { code: "JFK", name: "John F. Kennedy", city: "New York", country: "USA", lat: 40.641, lon: -73.778 },
  DXB: { code: "DXB", name: "Dubai International", city: "Dubaï", country: "UAE", lat: 25.252, lon: 55.364 },
  BKK: { code: "BKK", name: "Suvarnabhumi", city: "Bangkok", country: "Thaïlande", lat: 13.689, lon: 100.750 },
  BCN: { code: "BCN", name: "El Prat", city: "Barcelone", country: "Espagne", lat: 41.297, lon: 2.083 },
  FCO: { code: "FCO", name: "Fiumicino", city: "Rome", country: "Italie", lat: 41.804, lon: 12.251 },
  AMS: { code: "AMS", name: "Schiphol", city: "Amsterdam", country: "Pays-Bas", lat: 52.308, lon: 4.764 },
  MAD: { code: "MAD", name: "Barajas", city: "Madrid", country: "Espagne", lat: 40.472, lon: -3.561 },
  NYC: { code: "NYC", name: "New York (tous)", city: "New York", country: "USA", lat: 40.712, lon: -74.006 },
  TYO: { code: "TYO", name: "Tokyo (tous)", city: "Tokyo", country: "Japon", lat: 35.689, lon: 139.692 },
  NRT: { code: "NRT", name: "Narita", city: "Tokyo", country: "Japon", lat: 35.765, lon: 140.386 },
  SYD: { code: "SYD", name: "Kingsford Smith", city: "Sydney", country: "Australie", lat: -33.946, lon: 151.177 },
  MIA: { code: "MIA", name: "Miami International", city: "Miami", country: "USA", lat: 25.796, lon: -80.287 },
  LAX: { code: "LAX", name: "Los Angeles International", city: "Los Angeles", country: "USA", lat: 33.943, lon: -118.408 },
};

export const AIRLINES: Record<string, Airline> = {
  AF: { code: "AF", name: "Air France", logo: "/airlines/af.svg", rating: 4.2, onTimeRate: 78, legroom: "standard" },
  LH: { code: "LH", name: "Lufthansa", logo: "/airlines/lh.svg", rating: 4.3, onTimeRate: 82, legroom: "standard" },
  BA: { code: "BA", name: "British Airways", logo: "/airlines/ba.svg", rating: 4.1, onTimeRate: 79, legroom: "standard" },
  EK: { code: "EK", name: "Emirates", logo: "/airlines/ek.svg", rating: 4.8, onTimeRate: 86, legroom: "generous" },
  QR: { code: "QR", name: "Qatar Airways", logo: "/airlines/qr.svg", rating: 4.9, onTimeRate: 88, legroom: "generous" },
  SQ: { code: "SQ", name: "Singapore Airlines", logo: "/airlines/sq.svg", rating: 4.9, onTimeRate: 90, legroom: "generous" },
  FR: { code: "FR", name: "Ryanair", logo: "/airlines/fr.svg", rating: 3.1, onTimeRate: 88, legroom: "tight" },
  U2: { code: "U2", name: "easyJet", logo: "/airlines/u2.svg", rating: 3.4, onTimeRate: 82, legroom: "tight" },
  IB: { code: "IB", name: "Iberia", logo: "/airlines/ib.svg", rating: 4.0, onTimeRate: 77, legroom: "standard" },
  KL: { code: "KL", name: "KLM", logo: "/airlines/kl.svg", rating: 4.3, onTimeRate: 80, legroom: "standard" },
  TK: { code: "TK", name: "Turkish Airlines", logo: "/airlines/tk.svg", rating: 4.4, onTimeRate: 75, legroom: "standard" },
  NH: { code: "NH", name: "ANA", logo: "/airlines/nh.svg", rating: 4.7, onTimeRate: 92, legroom: "generous" },
  AA: { code: "AA", name: "American Airlines", logo: "/airlines/aa.svg", rating: 3.8, onTimeRate: 76, legroom: "standard" },
};

function makePrice(): number[] {
  const base = Math.floor(Math.random() * 800 + 200);
  return Array.from({ length: 30 }, (_, i) => {
    const variation = Math.sin(i * 0.5) * 80 + (Math.random() - 0.5) * 60;
    return Math.max(80, Math.round(base + variation));
  });
}

function priceHistory(basePrice: number) {
  const today = new Date();
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (29 - i));
    const variation = Math.sin(i * 0.4) * 50 + (Math.random() - 0.5) * 40;
    return {
      date: d.toISOString().slice(0, 10),
      price: Math.max(60, Math.round(basePrice + variation)),
    };
  });
}

export const MOCK_FLIGHTS: FlightOffer[] = [
  {
    id: "f001",
    segments: [{
      from: AIRPORTS.CDG, to: AIRPORTS.JFK,
      airline: AIRLINES.AF, flightNumber: "AF 006",
      departure: "2025-06-15T10:15:00", arrival: "2025-06-15T12:45:00",
      duration: 450, aircraft: "Boeing 777-300ER", stops: 0,
    }],
    price: 487,
    currency: "EUR",
    originalPrice: 620,
    priceSource: "Air France Direct",
    bookingUrl: "#",
    cabinClass: "economy",
    baggage: { cabin: true, checkedIncluded: 23, extraCost: 0 },
    isRefundable: false,
    isSeatSelectable: true,
    seatsLeft: 4,
    lastUpdated: new Date().toISOString(),
    priceHistory: priceHistory(487),
    totalDuration: 450,
    totalStops: 0,
    isDeal: true,
    dealLabel: "Meilleur rapport qualité/prix",
  },
  {
    id: "f002",
    segments: [{
      from: AIRPORTS.CDG, to: AIRPORTS.JFK,
      airline: AIRLINES.EK, flightNumber: "EK 073 / EK 201",
      departure: "2025-06-15T08:00:00", arrival: "2025-06-15T18:30:00",
      duration: 630, aircraft: "Airbus A380", stops: 1,
    }],
    price: 389,
    currency: "EUR",
    priceSource: "Expedia",
    bookingUrl: "#",
    cabinClass: "economy",
    baggage: { cabin: true, checkedIncluded: 30, extraCost: 0 },
    isRefundable: true,
    isSeatSelectable: true,
    seatsLeft: 12,
    lastUpdated: new Date().toISOString(),
    priceHistory: priceHistory(389),
    totalDuration: 630,
    totalStops: 1,
  },
  {
    id: "f003",
    segments: [{
      from: AIRPORTS.CDG, to: AIRPORTS.JFK,
      airline: AIRLINES.QR, flightNumber: "QR 038 / QR 701",
      departure: "2025-06-15T07:30:00", arrival: "2025-06-15T17:55:00",
      duration: 595, aircraft: "Boeing 787 Dreamliner", stops: 1,
    }],
    price: 412,
    currency: "EUR",
    priceSource: "Skyscanner",
    bookingUrl: "#",
    cabinClass: "economy",
    baggage: { cabin: true, checkedIncluded: 30, extraCost: 0 },
    isRefundable: false,
    isSeatSelectable: true,
    seatsLeft: 7,
    lastUpdated: new Date().toISOString(),
    priceHistory: priceHistory(412),
    totalDuration: 595,
    totalStops: 1,
    isDeal: true,
    dealLabel: "Erreur tarifaire détectée",
  },
  {
    id: "f004",
    segments: [{
      from: AIRPORTS.CDG, to: AIRPORTS.JFK,
      airline: AIRLINES.FR, flightNumber: "FR 1234 / B6 2200",
      departure: "2025-06-15T06:00:00", arrival: "2025-06-15T22:15:00",
      duration: 855, aircraft: "Boeing 737-800", stops: 2,
    }],
    price: 198,
    currency: "EUR",
    priceSource: "Kiwi.com",
    bookingUrl: "#",
    cabinClass: "economy",
    baggage: { cabin: false, checkedIncluded: 0, extraCost: 45 },
    isRefundable: false,
    isSeatSelectable: false,
    seatsLeft: 23,
    lastUpdated: new Date().toISOString(),
    priceHistory: priceHistory(198),
    totalDuration: 855,
    totalStops: 2,
  },
  {
    id: "f005",
    segments: [{
      from: AIRPORTS.CDG, to: AIRPORTS.JFK,
      airline: AIRLINES.BA, flightNumber: "BA 303",
      departure: "2025-06-15T13:00:00", arrival: "2025-06-15T15:30:00",
      duration: 450, aircraft: "Boeing 747-400", stops: 0,
    }],
    price: 534,
    currency: "EUR",
    priceSource: "British Airways Direct",
    bookingUrl: "#",
    cabinClass: "economy",
    baggage: { cabin: true, checkedIncluded: 23, extraCost: 0 },
    isRefundable: true,
    isSeatSelectable: true,
    seatsLeft: 2,
    lastUpdated: new Date().toISOString(),
    priceHistory: priceHistory(534),
    totalDuration: 450,
    totalStops: 0,
  },
  {
    id: "f006",
    segments: [{
      from: AIRPORTS.CDG, to: AIRPORTS.JFK,
      airline: AIRLINES.TK, flightNumber: "TK 1785 / TK 001",
      departure: "2025-06-15T09:15:00", arrival: "2025-06-15T20:10:00",
      duration: 655, aircraft: "Airbus A330-300", stops: 1,
    }],
    price: 356,
    currency: "EUR",
    priceSource: "Opodo",
    bookingUrl: "#",
    cabinClass: "economy",
    baggage: { cabin: true, checkedIncluded: 23, extraCost: 0 },
    isRefundable: false,
    isSeatSelectable: true,
    seatsLeft: 18,
    lastUpdated: new Date().toISOString(),
    priceHistory: priceHistory(356),
    totalDuration: 655,
    totalStops: 1,
  },
  {
    id: "f007",
    segments: [{
      from: AIRPORTS.CDG, to: AIRPORTS.JFK,
      airline: AIRLINES.SQ, flightNumber: "SQ 336 / SQ 022",
      departure: "2025-06-15T11:45:00", arrival: "2025-06-15T22:00:00",
      duration: 615, aircraft: "Airbus A350-900", stops: 1,
    }],
    price: 523,
    currency: "EUR",
    priceSource: "Singapore Airlines Direct",
    bookingUrl: "#",
    cabinClass: "economy",
    baggage: { cabin: true, checkedIncluded: 30, extraCost: 0 },
    isRefundable: true,
    isSeatSelectable: true,
    seatsLeft: 9,
    lastUpdated: new Date().toISOString(),
    priceHistory: priceHistory(523),
    totalDuration: 615,
    totalStops: 1,
    isDeal: true,
    dealLabel: "Meilleure compagnie",
  },
  {
    id: "f008",
    segments: [{
      from: AIRPORTS.CDG, to: AIRPORTS.JFK,
      airline: AIRLINES.LH, flightNumber: "LH 1034 / LH 400",
      departure: "2025-06-15T07:00:00", arrival: "2025-06-15T16:45:00",
      duration: 585, aircraft: "Airbus A340-600", stops: 1,
    }],
    price: 445,
    currency: "EUR",
    priceSource: "Booking.com",
    bookingUrl: "#",
    cabinClass: "economy",
    baggage: { cabin: true, checkedIncluded: 23, extraCost: 0 },
    isRefundable: false,
    isSeatSelectable: true,
    seatsLeft: 14,
    lastUpdated: new Date().toISOString(),
    priceHistory: priceHistory(445),
    totalDuration: 585,
    totalStops: 1,
  },
];

export const MOCK_HOTELS: Hotel[] = [
  {
    id: "h001",
    name: "The Standard High Line",
    stars: 4,
    address: "848 Washington Street, Meatpacking District",
    city: "New York",
    lat: 40.740, lon: -74.008,
    distanceCenter: 3.2,
    neighborhood: "Meatpacking District",
    thumbnail: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800",
    images: [],
    amenities: ["WiFi", "Piscine", "Spa", "Restaurant", "Bar", "Gym"],
    pricePerNight: 189,
    currency: "EUR",
    sources: [
      { name: "Booking.com", price: 189, url: "#", available: true },
      { name: "Hotels.com", price: 195, url: "#", available: true },
      { name: "Expedia", price: 192, url: "#", available: true },
    ],
    rating: 8.7,
    reviewCount: 2847,
    reviewHighlights: ["Vue incroyable", "Emplacement parfait", "Service top"],
    score: { total: 84, breakdown: { price: 78, location: 92, quality: 85, cleanliness: 88, service: 82 } },
    isRefundable: true,
    breakfast: false,
  },
  {
    id: "h002",
    name: "1 Hotel Brooklyn Bridge",
    stars: 5,
    address: "60 Furman Street, Brooklyn",
    city: "New York",
    lat: 40.702, lon: -73.993,
    distanceCenter: 4.8,
    neighborhood: "DUMBO, Brooklyn",
    thumbnail: "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800",
    images: [],
    amenities: ["WiFi", "Piscine Rooftop", "Spa", "Restaurant Bio", "Bar", "Vue Manhattan"],
    pricePerNight: 267,
    currency: "EUR",
    sources: [
      { name: "1Hotel Direct", price: 267, url: "#", available: true },
      { name: "Booking.com", price: 275, url: "#", available: true },
    ],
    rating: 9.1,
    reviewCount: 1632,
    reviewHighlights: ["Vue sur Manhattan époustouflante", "Éco-luxe unique", "Petit-déjeuner exceptionnel"],
    score: { total: 91, breakdown: { price: 70, location: 95, quality: 96, cleanliness: 97, service: 94 } },
    isRefundable: true,
    breakfast: true,
  },
  {
    id: "h003",
    name: "citizenM New York Bowery",
    stars: 3,
    address: "189 Bowery, Lower East Side",
    city: "New York",
    lat: 40.721, lon: -73.993,
    distanceCenter: 1.9,
    neighborhood: "Lower East Side",
    thumbnail: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800",
    images: [],
    amenities: ["WiFi Ultra-rapide", "Bar 24h", "Lounge", "SmartTV", "Gym"],
    pricePerNight: 129,
    currency: "EUR",
    sources: [
      { name: "citizenM Direct", price: 129, url: "#", available: true },
      { name: "Expedia", price: 135, url: "#", available: true },
      { name: "Agoda", price: 131, url: "#", available: true },
    ],
    rating: 8.9,
    reviewCount: 4211,
    reviewHighlights: ["Meilleur rapport qualité/prix", "Design moderne", "Tech innovante"],
    score: { total: 88, breakdown: { price: 95, location: 88, quality: 86, cleanliness: 90, service: 84 } },
    isRefundable: false,
    breakfast: false,
  },
  {
    id: "h004",
    name: "The Beekman",
    stars: 5,
    address: "123 Nassau Street, Financial District",
    city: "New York",
    lat: 40.711, lon: -74.007,
    distanceCenter: 0.8,
    neighborhood: "Financial District",
    thumbnail: "https://images.unsplash.com/photo-1559508551-44bff1de756b?w=800",
    images: [],
    amenities: ["WiFi", "Restaurant Tom Colicchio", "Bar", "Spa", "Service voiturier"],
    pricePerNight: 342,
    currency: "EUR",
    sources: [
      { name: "Beekman Direct", price: 342, url: "#", available: true },
      { name: "Booking.com", price: 358, url: "#", available: false },
    ],
    rating: 9.3,
    reviewCount: 987,
    reviewHighlights: ["Architecture sublime XIXe", "Bâtiment historique", "Service impeccable"],
    score: { total: 87, breakdown: { price: 58, location: 96, quality: 98, cleanliness: 97, service: 96 } },
    isRefundable: true,
    breakfast: false,
  },
];

export const MOCK_ALERTS: PriceAlert[] = [
  {
    id: "a001",
    route: "CDG → JFK",
    from: "Paris CDG",
    to: "New York JFK",
    targetPrice: 400,
    currentPrice: 487,
    trend: "falling",
    channel: "both",
    active: true,
    createdAt: "2025-05-20T10:00:00",
    lastTriggered: undefined,
  },
  {
    id: "a002",
    route: "CDG → BKK",
    from: "Paris CDG",
    to: "Bangkok BKK",
    targetPrice: 550,
    currentPrice: 523,
    trend: "falling",
    channel: "telegram",
    active: true,
    createdAt: "2025-05-18T14:30:00",
    lastTriggered: "2025-05-21T09:15:00",
  },
  {
    id: "a003",
    route: "CDG → TYO",
    from: "Paris CDG",
    to: "Tokyo NRT",
    targetPrice: 700,
    currentPrice: 812,
    trend: "rising",
    channel: "email",
    active: false,
    createdAt: "2025-05-10T08:00:00",
  },
];

export function generateCalendarPrices(basePrice: number): CalendarPriceDay[] {
  const today = new Date();
  const days: CalendarPriceDay[] = [];
  let minPrice = Infinity;

  const prices = Array.from({ length: 60 }, () => {
    const v = basePrice + (Math.random() - 0.5) * basePrice * 0.6;
    return Math.max(80, Math.round(v));
  });

  minPrice = Math.min(...prices);

  for (let i = 0; i < 60; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const price = prices[i];
    days.push({
      date: d.toISOString().slice(0, 10),
      price,
      isLowest: price === minPrice,
      isDeal: price <= minPrice * 1.1,
    });
  }
  return days;
}

export const POPULAR_ROUTES = [
  { from: "Paris", to: "New York", price: 387, flag: "🇺🇸" },
  { from: "Paris", to: "Tokyo", price: 612, flag: "🇯🇵" },
  { from: "Paris", to: "Bangkok", price: 498, flag: "🇹🇭" },
  { from: "Paris", to: "Miami", price: 354, flag: "🇺🇸" },
  { from: "Paris", to: "Barcelone", price: 49, flag: "🇪🇸" },
  { from: "Paris", to: "Dubaï", price: 289, flag: "🇦🇪" },
  { from: "Paris", to: "Sydney", price: 954, flag: "🇦🇺" },
  { from: "Paris", to: "Los Angeles", price: 421, flag: "🇺🇸" },
];

export const PRICE_PREDICTION: {
  recommendation: string;
  confidence: number;
  reason: string;
  trend: "falling" | "rising" | "stable";
  priceIn7Days: number;
  priceIn14Days: number;
  priceIn30Days: number;
} = {
  recommendation: "Réservez maintenant",
  confidence: 82,
  reason: "Les prix ont baissé de 12% sur cette route. La tendance indique une remontée dans 4-6 jours.",
  trend: "falling",
  priceIn7Days: 534,
  priceIn14Days: 587,
  priceIn30Days: 621,
};
