import type { FlightOffer, FlightScore, UserPreferences, ScoreWeights } from "./types";

const DEFAULT_WEIGHTS: ScoreWeights = {
  price: 30,
  duration: 20,
  airline: 15,
  schedule: 10,
  comfort: 10,
  baggage: 5,
  reliability: 5,
  reviews: 5,
};

function normalize(value: number, min: number, max: number, invert = false): number {
  if (max === min) return 50;
  const normalized = ((value - min) / (max - min)) * 100;
  return invert ? 100 - normalized : normalized;
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

export function scoreFlights(
  flights: FlightOffer[],
  prefs?: Partial<UserPreferences>
): FlightOffer[] {
  if (flights.length === 0) return [];

  const weights = { ...DEFAULT_WEIGHTS, ...prefs?.weights };
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

  const prices = flights.map((f) => f.price);
  const durations = flights.map((f) => f.totalDuration);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minDur = Math.min(...durations);
  const maxDur = Math.max(...durations);

  const scored = flights.map((flight) => {
    const airline = flight.segments[0]?.airline;
    const departHour = new Date(flight.segments[0]?.departure).getHours();

    // Price score: cheaper = higher score, but with diminishing returns
    const rawPriceScore = normalize(flight.price, minPrice, maxPrice, true);
    const priceScore = clamp(rawPriceScore);

    // Duration score: shorter = better
    const durationScore = clamp(normalize(flight.totalDuration, minDur, maxDur, true));

    // Airline quality score (0-100 based on rating 1-5)
    const airlineScore = clamp(airline ? ((airline.rating - 1) / 4) * 100 : 50);

    // Schedule score: prefer 7h-14h departures
    let scheduleScore = 50;
    if (departHour >= 7 && departHour <= 14) scheduleScore = 90;
    else if (departHour >= 6 && departHour <= 20) scheduleScore = 65;
    else scheduleScore = 25;
    if (prefs?.idealDepartureRange) {
      const [prefMin, prefMax] = prefs.idealDepartureRange;
      scheduleScore = departHour >= prefMin && departHour <= prefMax ? 95 : 30;
    }

    // Comfort: legroom + cabin class
    const legroomMap = { tight: 30, standard: 65, generous: 95 };
    const cabinMap = { economy: 50, premium_economy: 70, business: 90, first: 100 };
    const comfortScore = clamp(
      (legroomMap[airline?.legroom ?? "standard"] * 0.5) +
      (cabinMap[flight.cabinClass] * 0.5)
    );

    // Baggage score
    const baggageScore = clamp(
      (flight.baggage.cabin ? 30 : 0) +
      (flight.baggage.checkedIncluded > 0 ? 50 : 0) +
      (flight.baggage.checkedIncluded >= 30 ? 20 : 0)
    );

    // Reliability: on-time performance
    const reliabilityScore = clamp(airline ? airline.onTimeRate : 75);

    // Reviews: based on airline rating
    const reviewScore = clamp(airline ? ((airline.rating - 1) / 4) * 100 : 60);

    const breakdown = {
      price: Math.round(priceScore),
      duration: Math.round(durationScore),
      airline: Math.round(airlineScore),
      schedule: Math.round(scheduleScore),
      comfort: Math.round(comfortScore),
      baggage: Math.round(baggageScore),
      reliability: Math.round(reliabilityScore),
      reviews: Math.round(reviewScore),
    };

    const total = clamp(Math.round(
      (breakdown.price * weights.price +
        breakdown.duration * weights.duration +
        breakdown.airline * weights.airline +
        breakdown.schedule * weights.schedule +
        breakdown.comfort * weights.comfort +
        breakdown.baggage * weights.baggage +
        breakdown.reliability * weights.reliability +
        breakdown.reviews * weights.reviews) / totalWeight
    ));

    let recommendation: FlightScore["recommendation"] = "best_value";
    if (total === Math.max(...scored?.map((s) => s.score?.total ?? 0) ?? [total])) {
      recommendation = "best_value";
    }
    if (durationScore > 85 && flight.totalStops === 0) recommendation = "fastest";
    if (priceScore > 85) recommendation = "cheapest";
    if (comfortScore > 85 && airlineScore > 80) recommendation = "most_comfortable";

    const labels: Record<FlightScore["recommendation"], string> = {
      best_value: "Meilleur rapport qualité/prix",
      fastest: "Le plus rapide",
      cheapest: "Le moins cher",
      most_comfortable: "Le plus confortable",
    };

    const score: FlightScore = {
      total,
      breakdown,
      recommendation,
      label: labels[recommendation],
    };

    return { ...flight, score };
  });

  return scored.sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0));
}

export function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 65) return "text-aeris-400";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
}

export function getScoreBg(score: number): string {
  if (score >= 80) return "bg-emerald-400/10 border-emerald-400/30";
  if (score >= 65) return "bg-aeris-500/10 border-aeris-400/30";
  if (score >= 50) return "bg-amber-400/10 border-amber-400/30";
  return "bg-red-400/10 border-red-400/30";
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m > 0 ? String(m).padStart(2, "0") : ""}`;
}

export function formatPrice(price: number, currency = "EUR"): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: 0 }).format(price);
}
