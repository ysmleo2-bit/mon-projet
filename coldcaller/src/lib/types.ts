export type LeadStatus = "new" | "contacted" | "interested" | "rdv" | "client" | "lost";
export type CallOutcome = "no_answer" | "interested" | "not_interested" | "rdv" | "callback";

export interface CallRecord {
  at:       string;       // ISO date
  duration: number;       // seconds
  outcome:  CallOutcome;
  notes?:   string;
}

export interface Lead {
  id: string;
  name: string;           // business name
  category: string;       // e.g. "Plombier", "Restaurant"
  phone: string;
  address: string;
  city: string;
  rating: number;         // 1–5
  reviewCount: number;
  website?: string;
  email?: string;
  status: LeadStatus;
  notes: string;
  lastContact?: string;   // ISO date
  rdvDate?: string;       // ISO date
  source: "google_maps" | "manual" | "import" | "openstreetmap" | "sirene";
  detectedAt: string;
  callCount: number;
  callHistory?: CallRecord[];
}

export interface PipelineColumn {
  id: LeadStatus;
  label: string;
  color: string;
  bg: string;
  border: string;
}

export interface PlanTier {
  id: string;
  name: string;
  price: number;
  leads: number;
  seats: number;
  features: string[];
  highlighted?: boolean;
  cta: string;
}

export interface SearchQuery {
  niche: string;
  city: string;
  radius: number;
  minRating: number;
}

export interface CallSession {
  leadId: string;
  startedAt: string;
  duration?: number;  // seconds
  outcome?: "no_answer" | "interested" | "not_interested" | "rdv" | "callback";
  notes: string;
}
