export type CabinClass = "economy" | "premium_economy" | "business" | "first";
export type TripType = "one-way" | "round-trip" | "multi-city";
export type SortBy = "score" | "price" | "duration" | "departure" | "arrival";

export interface Airport {
  code: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
}

export interface Airline {
  code: string;
  name: string;
  logo: string;
  rating: number;
  onTimeRate: number;
  legroom: "tight" | "standard" | "generous";
}

export interface Segment {
  from: Airport;
  to: Airport;
  airline: Airline;
  flightNumber: string;
  departure: string;
  arrival: string;
  duration: number; // minutes
  aircraft: string;
  stops: number;
}

export interface BaggagePolicy {
  cabin: boolean;
  checkedIncluded: number; // kg, 0 = not included
  extraCost: number;
}

export interface FlightOffer {
  id: string;
  segments: Segment[];
  returnSegments?: Segment[];
  price: number;
  currency: string;
  originalPrice?: number;
  priceSource: string;
  bookingUrl: string;
  cabinClass: CabinClass;
  baggage: BaggagePolicy;
  isRefundable: boolean;
  isSeatSelectable: boolean;
  seatsLeft: number;
  lastUpdated: string;
  priceHistory: PricePoint[];
  // Computed
  totalDuration: number; // minutes
  totalStops: number;
  score?: FlightScore;
  isDeal?: boolean;
  dealLabel?: string;
}

export interface PricePoint {
  date: string;
  price: number;
}

export interface FlightScore {
  total: number; // 0-100
  breakdown: {
    price: number;
    duration: number;
    airline: number;
    schedule: number;
    comfort: number;
    baggage: number;
    reliability: number;
    reviews: number;
  };
  recommendation: "best_value" | "fastest" | "cheapest" | "most_comfortable";
  label: string;
}

export interface UserPreferences {
  budgetMax: number;
  maxDuration: number; // minutes
  maxStops: number;
  preferredAirlines: string[];
  avoidAirlines: string[];
  preferredAirports: string[];
  idealDepartureRange: [number, number]; // hours [6, 22]
  baggageRequired: boolean;
  cabinClass: CabinClass;
  flexibleDates: boolean;
  weights: ScoreWeights;
}

export interface ScoreWeights {
  price: number;
  duration: number;
  airline: number;
  schedule: number;
  comfort: number;
  baggage: number;
  reliability: number;
  reviews: number;
}

export interface SearchParams {
  from: string;
  to: string;
  departDate: string;
  returnDate?: string;
  adults: number;
  children: number;
  infants: number;
  cabinClass: CabinClass;
  tripType: TripType;
  flexible: boolean;
}

export interface CalendarPriceDay {
  date: string;
  price: number | null;
  isLowest: boolean;
  isDeal: boolean;
}

// Hotels
export interface Hotel {
  id: string;
  name: string;
  stars: number;
  address: string;
  city: string;
  lat: number;
  lon: number;
  distanceCenter: number; // km
  neighborhood: string;
  thumbnail: string;
  images: string[];
  amenities: string[];
  pricePerNight: number;
  currency: string;
  sources: HotelSource[];
  rating: number;
  reviewCount: number;
  reviewHighlights: string[];
  score: HotelScore;
  isRefundable: boolean;
  breakfast: boolean;
}

export interface HotelSource {
  name: string;
  price: number;
  url: string;
  available: boolean;
}

export interface HotelScore {
  total: number;
  breakdown: {
    price: number;
    location: number;
    quality: number;
    cleanliness: number;
    service: number;
  };
}

// Alerts
export interface PriceAlert {
  id: string;
  route: string;
  from: string;
  to: string;
  targetPrice: number;
  currentPrice: number;
  trend: "rising" | "falling" | "stable";
  channel: "email" | "telegram" | "both";
  active: boolean;
  createdAt: string;
  lastTriggered?: string;
}

// API response wrapper
export interface SearchResult {
  flights: FlightOffer[];
  totalFound: number;
  searchedSources: string[];
  searchDuration: number;
  priceRange: { min: number; max: number };
  calendarPrices: CalendarPriceDay[];
}
