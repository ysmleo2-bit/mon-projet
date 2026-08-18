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

// ── Statuts d'appel commercial ────────────────────────────────────────────────
export type StatutAppel =
  | "non_appele"
  | "decroche"
  | "pas_decroche"
  | "numero_invalide"
  | "echange_effectue"
  | "message_envoye"
  | "a_rappeler";

export const STATUT_APPEL_LABELS: Record<StatutAppel, string> = {
  non_appele:       "Non appelé",
  decroche:         "A décroché",
  pas_decroche:     "Pas décroché",
  numero_invalide:  "N° invalide",
  echange_effectue: "Échange effectué",
  message_envoye:   "Message laissé",
  a_rappeler:       "À rappeler",
};

export const STATUT_APPEL_COLORS: Record<StatutAppel, string> = {
  non_appele:       "bg-white/[0.06] text-white/30 border-white/10",
  decroche:         "bg-green-500/20 text-green-300 border-green-500/30",
  pas_decroche:     "bg-amber-500/20 text-amber-300 border-amber-500/30",
  numero_invalide:  "bg-red-500/20 text-red-400 border-red-500/30",
  echange_effectue: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  message_envoye:   "bg-violet-500/20 text-violet-300 border-violet-500/30",
  a_rappeler:       "bg-orange-500/20 text-orange-300 border-orange-500/30",
};

// ── Action (historique) ───────────────────────────────────────────────────────
export interface ProspectAction {
  date:   string;
  type:   "enrichissement" | "email_genere" | "email_envoye" | "statut" | "note" | "appel";
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
  id:     string;  // = "prospect-{siren}"
  siren:  string;
  siret?: string;  // siège social

  // ─ Infos société
  nom:             string;
  nomCommercial?:  string;
  codeNaf:         string;
  libelleNaf:      string;
  secteur:         string;
  adresse?:        string;
  ville?:          string;
  codePostal?:     string;
  departement?:    string;

  // ─ Taille & finances
  trancheEffectifs?: string;  // "00", "01", "02"…"53"
  dateCreation?:     string;

  // ─ Présence digitale
  siteWeb?:            string;
  linkedinEntreprise?: string;
  googlePresence?:     boolean;

  // ─ Dirigeant(s)
  dirigeants:          Dirigeant[];
  dirigeantPrincipal?: string;    // nom complet formaté
  fonctionDirigeant?:  string;
  emailDirigeant?:     string;
  emailSource?:        DataSource;
  emailVerifie?:       boolean;
  telephonePro?:       string;
  linkedinDirigeant?:  string;

  // ─ Qualification IA
  problematique?:  string;
  observation?:    string;
  angleApproche?:  string;
  scoreQualif?:    number;  // 0-100

  // ─ Email généré
  emailObjet?:  string;
  emailCorps?:  string;

  // ─ Pipeline
  statut:          ProspectStatut;
  enrichiAt?:      string;
  emailEnvoyeAt?:  string;

  // ─ Suivi commercial (appel)
  statutAppel?:       StatutAppel;
  dateAppel?:         string;
  notesCommercial?:   string;
  danscrm?:           boolean;
  dateCrm?:           string;

  // ─ Métadonnées
  createdAt:  string;
  updatedAt:  string;
  sources:    DataSource[];
  actions:    ProspectAction[];
  notes?:     string;
}

// ── Paramètres de recherche ───────────────────────────────────────────────────
export interface SearchParams {
  nafCodes?:    string[];
  secteur?:     string;
  departement?: string;
  ville?:       string;
  trancheMin?:  string;
  trancheMax?:  string;
  page?:        number;
  perPage?:     number;
}

// ── Tranche d'effectifs ───────────────────────────────────────────────────────
export const TRANCHES_EFFECTIFS: Record<string, string> = {
  "00": "0 salarié",
  "01": "1-2 salariés",
  "02": "3-5 salariés",
  "03": "6-9 salariés",
  "11": "10-19 salariés",
  "12": "20-49 salariés",
  "21": "50-99 salariés",
  "22": "100-199 salariés",
  "31": "200-249 salariés",
  "32": "250-499 salariés",
  "41": "500-999 salariés",
  "42": "1 000-1 999 salariés",
  "51": "2 000-4 999 salariés",
  "52": "5 000-9 999 salariés",
  "53": "10 000+ salariés",
  "NN": "Effectif non renseigné",
};
