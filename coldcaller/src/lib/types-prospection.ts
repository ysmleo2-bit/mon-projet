/**
 * types-prospection.ts — Modèle de données de l'agent B2B
 */

// ── Statuts du pipeline ───────────────────────────────────────────────────────
export type ProspectStatut =
  | "nouveau"
  | "a_enrichir"
  | "enrichi"
  | "email_trouve"
  | "email_verifie"
  | "pret_a_envoyer"
  | "email_envoye"
  | "repondu"
  | "interesse"
  | "pas_interesse"
  | "a_relancer"
  | "erreur";

export const STATUT_LABELS: Record<ProspectStatut, string> = {
  nouveau:          "Nouveau",
  a_enrichir:       "À enrichir",
  enrichi:          "Enrichi",
  email_trouve:     "Email trouvé",
  email_verifie:    "Email vérifié",
  pret_a_envoyer:   "Prêt à envoyer",
  email_envoye:     "Email envoyé",
  repondu:          "Répondu",
  interesse:        "Intéressé",
  pas_interesse:    "Pas intéressé",
  a_relancer:       "À relancer",
  erreur:           "Erreur",
};

export const STATUT_COLORS: Record<ProspectStatut, string> = {
  nouveau:          "bg-white/10 text-white/50",
  a_enrichir:       "bg-amber-500/15 text-amber-300",
  enrichi:          "bg-sky-500/15 text-sky-300",
  email_trouve:     "bg-violet-500/15 text-violet-300",
  email_verifie:    "bg-blue-500/15 text-blue-300",
  pret_a_envoyer:   "bg-green-500/15 text-green-300",
  email_envoye:     "bg-brand-500/15 text-brand-300",
  repondu:          "bg-teal-500/15 text-teal-300",
  interesse:        "bg-emerald-500/15 text-emerald-300",
  pas_interesse:    "bg-red-500/15 text-red-400",
  a_relancer:       "bg-orange-500/15 text-orange-300",
  erreur:           "bg-red-900/20 text-red-400",
};

// ── Action (historique) ───────────────────────────────────────────────────────
export interface ProspectAction {
  date:   string;
  type:   "enrichissement" | "email_genere" | "email_envoye" | "statut" | "note";
  detail: string;
}

// ── Dirigeant ─────────────────────────────────────────────────────────────────
export interface Dirigeant {
  nom:      string;
  prenoms?: string;
  qualite?: string;  // Gérant, Président, DG…
}

// ── Source de données ─────────────────────────────────────────────────────────
export type DataSource =
  | "sirene"
  | "google_places"
  | "website_scraping"
  | "pattern_email"
  | "pappers"
  | "manuel";

// ── Prospect principal ────────────────────────────────────────────────────────
export interface Prospect {
  // ─ Identifiants
  id:     string;  // = siren (clé primaire anti-doublon)
  siren:  string;
  siret?: string;  // siège social

  // ─ Infos société
  nom:           string;
  nomCommercial?: string;
  codeNaf:       string;
  libelleNaf:    string;
  secteur:       string;
  adresse?:      string;
  ville?:        string;
  codePostal?:   string;
  departement?:  string;

  // ─ Taille & finances
  trancheEffectifs?: string;  // "00", "01", "02"…"53"
  dateCreation?:     string;

  // ─ Présence digitale
  siteWeb?:          string;
  linkedinEntreprise?: string;
  googlePresence?:   boolean;

  // ─ Dirigeant(s)
  dirigeants:        Dirigeant[];
  dirigeantPrincipal?: string;   // nom complet formaté
  fonctionDirigeant?:  string;
  emailDirigeant?:     string;
  emailSource?:        DataSource;
  emailVerifie?:       boolean;
  telephonePro?:       string;
  linkedinDirigeant?:  string;

  // ─ Qualification IA
  problematique?:  string;  // problématique d'acquisition identifiée
  observation?:    string;  // observation spécifique à l'entreprise
  angleApproche?:  string;  // angle d'accroche
  scoreQualif?:    number;  // 0-100

  // ─ Email généré
  emailObjet?:     string;
  emailCorps?:     string;

  // ─ Pipeline
  statut:          ProspectStatut;
  enrichiAt?:      string;
  emailEnvoyeAt?:  string;

  // ─ Métadonnées
  createdAt:  string;
  updatedAt:  string;
  sources:    DataSource[];
  actions:    ProspectAction[];
  notes?:     string;
}

// ── Paramètres de recherche ───────────────────────────────────────────────────
export interface SearchParams {
  nafCodes?:      string[];   // ["43.21A", "43.22A"]
  secteur?:       string;     // fallback text search
  departement?:   string;     // "69", "75"…
  ville?:         string;
  trancheMin?:    string;     // code tranche effectifs min
  trancheMax?:    string;
  page?:          number;
  perPage?:       number;
}

// ── Tranche d'effectifs ───────────────────────────────────────────────────────
export const TRANCHES_EFFECTIFS: Record<string, string> = {
  "00": "0 salarié",
  "01": "1-2",
  "02": "3-5",
  "03": "6-9",
  "11": "10-19",
  "12": "20-49",
  "21": "50-99",
  "22": "100-199",
  "31": "200-249",
  "32": "250-499",
  "41": "500-999",
  "42": "1 000-1 999",
  "51": "2 000-4 999",
  "52": "5 000-9 999",
  "53": "10 000+",
};
