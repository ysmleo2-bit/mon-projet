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
  nouveau:          "bg-gray-100 text-gray-500",
  a_enrichir:       "bg-amber-50 text-amber-700",
  enrichi:          "bg-sky-50 text-sky-700",
  email_trouve:     "bg-violet-50 text-violet-700",
  email_verifie:    "bg-blue-50 text-blue-700",
  pret_a_envoyer:   "bg-green-50 text-green-700",
  email_envoye:     "bg-brand-50 text-brand-700",
  repondu:          "bg-teal-50 text-teal-700",
  interesse:        "bg-emerald-50 text-emerald-700",
  pas_interesse:    "bg-red-50 text-red-600",
  a_relancer:       "bg-orange-50 text-orange-700",
  erreur:           "bg-red-100 text-red-600",
};

// ── Statuts d'appel commercial ────────────────────────────────────────────────
export type StatutAppel =
  | "non_appele"
  | "decroche"
  | "pas_decroche"
  | "numero_invalide"
  | "mail_envoye"
  | "echange_sans_suite"
  | "r1_booke"
  | "a_rappeler";

export const STATUT_APPEL_LABELS: Record<StatutAppel, string> = {
  non_appele:         "Non appelé",
  decroche:           "Décroché",
  pas_decroche:       "Pas décroché",
  numero_invalide:    "Numéro invalide",
  mail_envoye:        "Mail envoyé",
  echange_sans_suite: "Échange sans suite",
  r1_booke:           "R1 booké",
  a_rappeler:         "À rappeler",
};

export const STATUT_APPEL_COLORS: Record<StatutAppel, string> = {
  non_appele:         "bg-gray-100 text-gray-500 border-gray-200",
  decroche:           "bg-green-50 text-green-700 border-green-200",
  pas_decroche:       "bg-amber-50 text-amber-700 border-amber-200",
  numero_invalide:    "bg-red-50 text-red-600 border-red-200",
  mail_envoye:        "bg-violet-50 text-violet-700 border-violet-200",
  echange_sans_suite: "bg-teal-50 text-teal-700 border-teal-200",
  r1_booke:           "bg-brand-50 text-brand-700 border-brand-200",
  a_rappeler:         "bg-orange-50 text-orange-700 border-orange-200",
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
  | "pages_jaunes"
  | "societe_com"
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
  adresseVerifiee?: string;
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
