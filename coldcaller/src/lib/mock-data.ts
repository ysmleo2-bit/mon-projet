import type { Lead, PipelineColumn, PlanTier } from "./types";

export const PIPELINE_COLS: PipelineColumn[] = [
  { id: "new",        label: "Nouveaux",   color: "text-white/60",    bg: "bg-white/[0.04]",    border: "border-white/[0.08]" },
  { id: "contacted",  label: "Contactés",  color: "text-brand-400",   bg: "bg-brand-500/[0.06]", border: "border-brand-500/20" },
  { id: "interested", label: "Intéressés", color: "text-amber-400",   bg: "bg-amber-500/[0.06]", border: "border-amber-500/20" },
  { id: "rdv",        label: "RDV",        color: "text-violet-400",  bg: "bg-violet-500/[0.06]",border: "border-violet-500/20" },
  { id: "client",     label: "Clients",    color: "text-emerald-400", bg: "bg-emerald-500/[0.06]",border: "border-emerald-500/20" },
  { id: "lost",       label: "Perdus",     color: "text-red-400",     bg: "bg-red-500/[0.06]",   border: "border-red-500/20" },
];

export const MOCK_LEADS: Lead[] = [
  // NEW
  { id: "l001", name: "Plomberie Dupont", category: "Plombier", phone: "06 12 34 56 78", address: "12 rue Victor Hugo", city: "Lyon", rating: 4.3, reviewCount: 87, website: "plomberie-dupont.fr", status: "new", notes: "", detectedAt: new Date(Date.now() - 5 * 60000).toISOString(), source: "google_maps", callCount: 0 },
  { id: "l002", name: "Électricité Martin", category: "Électricien", phone: "06 87 65 43 21", address: "45 avenue Berthelot", city: "Lyon", rating: 4.7, reviewCount: 134, status: "new", notes: "", detectedAt: new Date(Date.now() - 8 * 60000).toISOString(), source: "google_maps", callCount: 0 },
  { id: "l003", name: "Maçonnerie Lefèvre", category: "Maçon", phone: "06 55 44 33 22", address: "8 impasse des Lilas", city: "Villeurbanne", rating: 3.9, reviewCount: 23, status: "new", notes: "", detectedAt: new Date(Date.now() - 12 * 60000).toISOString(), source: "google_maps", callCount: 0 },
  { id: "l004", name: "Serrurier Express", category: "Serrurier", phone: "06 11 22 33 44", address: "5 rue Garibaldi", city: "Lyon", rating: 4.5, reviewCount: 210, status: "new", notes: "", detectedAt: new Date(Date.now() - 20 * 60000).toISOString(), source: "google_maps", callCount: 0 },
  { id: "l005", name: "Peinture Moreau", category: "Peintre", phone: "06 99 88 77 66", address: "23 bd des Brotteaux", city: "Lyon", rating: 4.2, reviewCount: 56, status: "new", notes: "", detectedAt: new Date(Date.now() - 25 * 60000).toISOString(), source: "google_maps", callCount: 0 },
  // CONTACTED
  { id: "l006", name: "Toiture Bernard", category: "Couvreur", phone: "06 10 20 30 40", address: "17 rue de la Paix", city: "Bron", rating: 4.8, reviewCount: 312, status: "contacted", notes: "Pas répondu — rappeler en fin d'après-midi", lastContact: new Date(Date.now() - 2 * 3600000).toISOString(), detectedAt: new Date(Date.now() - 3600000).toISOString(), source: "google_maps", callCount: 1 },
  { id: "l007", name: "Carrelage Fontaine", category: "Carreleur", phone: "06 70 80 90 01", address: "2 rue du Commerce", city: "Décines", rating: 4.1, reviewCount: 44, status: "contacted", notes: "Intéressé mais occupé. Rappeler jeudi", lastContact: new Date(Date.now() - 4 * 3600000).toISOString(), detectedAt: new Date(Date.now() - 5 * 3600000).toISOString(), source: "google_maps", callCount: 2 },
  { id: "l008", name: "Menuiserie Girard", category: "Menuisier", phone: "06 33 44 55 66", address: "89 route de Genas", city: "Meyzieu", rating: 4.4, reviewCount: 78, status: "contacted", notes: "", lastContact: new Date(Date.now() - 6 * 3600000).toISOString(), detectedAt: new Date(Date.now() - 7 * 3600000).toISOString(), source: "google_maps", callCount: 1 },
  // INTERESTED
  { id: "l009", name: "Chauffage Rousseau", category: "Chauffagiste", phone: "06 22 33 44 55", address: "6 bd Vivier-Merle", city: "Lyon", rating: 4.6, reviewCount: 189, status: "interested", notes: "Veut une démo. Rappeler lundi 10h", lastContact: new Date(Date.now() - 24 * 3600000).toISOString(), detectedAt: new Date(Date.now() - 26 * 3600000).toISOString(), source: "google_maps", callCount: 3 },
  { id: "l010", name: "Isolation Petit", category: "Artisan RGE", phone: "06 44 55 66 77", address: "14 rue Paul Bert", city: "Lyon", rating: 4.9, reviewCount: 421, status: "interested", notes: "Très chaud. Envoyer offre par mail", lastContact: new Date(Date.now() - 18 * 3600000).toISOString(), detectedAt: new Date(Date.now() - 20 * 3600000).toISOString(), source: "google_maps", callCount: 2 },
  // RDV
  { id: "l011", name: "Paysagiste Blanc", category: "Paysagiste", phone: "06 66 77 88 99", address: "3 chemin des Chênes", city: "Caluire", rating: 4.5, reviewCount: 96, status: "rdv", notes: "RDV Teams mercredi 14h ✅", rdvDate: new Date(Date.now() + 2 * 86400000).toISOString(), lastContact: new Date(Date.now() - 12 * 3600000).toISOString(), detectedAt: new Date(Date.now() - 2 * 86400000).toISOString(), source: "google_maps", callCount: 4 },
  { id: "l012", name: "Rénovation Simon", category: "Entreprise TP", phone: "06 55 66 77 88", address: "28 avenue du 8 mai", city: "Saint-Priest", rating: 4.3, reviewCount: 67, status: "rdv", notes: "Vendredi 9h — visio Zoom", rdvDate: new Date(Date.now() + 4 * 86400000).toISOString(), lastContact: new Date(Date.now() - 86400000).toISOString(), detectedAt: new Date(Date.now() - 3 * 86400000).toISOString(), source: "google_maps", callCount: 3 },
  // CLIENT
  { id: "l013", name: "Nettoyage Pro Dubois", category: "Nettoyage", phone: "06 11 33 55 77", address: "7 rue Tête d'Or", city: "Lyon", rating: 4.7, reviewCount: 203, status: "client", notes: "Abonné Starter depuis 2 semaines 🎉", lastContact: new Date(Date.now() - 5 * 86400000).toISOString(), detectedAt: new Date(Date.now() - 7 * 86400000).toISOString(), source: "google_maps", callCount: 5 },
  // LOST
  { id: "l014", name: "Plomberie Richard", category: "Plombier", phone: "06 22 44 66 88", address: "11 rue de Sèze", city: "Lyon", rating: 3.6, reviewCount: 12, status: "lost", notes: "Pas intéressé pour le moment", lastContact: new Date(Date.now() - 3 * 86400000).toISOString(), detectedAt: new Date(Date.now() - 4 * 86400000).toISOString(), source: "google_maps", callCount: 2 },
];

export const PLANS: PlanTier[] = [
  {
    id: "starter",
    name: "Starter",
    price: 19,
    leads: 300,
    seats: 1,
    cta: "Choisir Starter",
    features: [
      "300 leads avec numéros directs / mois",
      "Scraper Google Maps inclus",
      "CRM visuel avec pipeline",
      "Interface d'appel avec script",
      "Historique des appels",
      "Import / Export CSV",
      "Support email",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 49,
    leads: 900,
    seats: 2,
    highlighted: true,
    cta: "Choisir Pro",
    features: [
      "900 leads / mois",
      "Tout Starter inclus",
      "2 sièges inclus",
      "Intégration Google Calendar",
      "Rappels automatiques WhatsApp",
      "Analytics avancés",
      "Support prioritaire",
    ],
  },
  {
    id: "agence",
    name: "Agence",
    price: 99,
    leads: 2000,
    seats: 5,
    cta: "Choisir Agence",
    features: [
      "2 000 leads / mois",
      "Tout Pro inclus",
      "5 sièges inclus",
      "Recherches illimitées",
      "Tableau de bord multi-clients",
      "API access",
      "Account manager dédié",
    ],
  },
];

export const CALL_SCRIPT = `Bonjour, je suis bien en ligne avec [NOM] ?

Je vous appelle car votre entreprise [NOM_ENTREPRISE] apparaît sur Google Maps dans ma zone et j'avais une question rapide.

On travaille avec pas mal d'artisans dans votre secteur pour les aider à trouver plus de clients, et j'avais une question : est-ce que la prospection téléphonique fait partie de votre développement commercial en ce moment ?

[ÉCOUTER]

→ Si OUI : Super ! Notre outil ColdCaller permet à vos commerciaux de trouver 500 prospects qualifiés en 10 minutes. Vous seriez disponible 15 minutes cette semaine pour une démo ?

→ Si PAS MAINTENANT : Je comprends tout à fait. Je peux vous recontacter dans [X semaines] ?

→ Si NON : Pas de souci ! Bonne journée.`;

export const NICHES = [
  "Plombier", "Électricien", "Maçon", "Serrurier", "Peintre", "Couvreur",
  "Carreleur", "Menuisier", "Chauffagiste", "Paysagiste", "Nettoyage",
  "Restaurant", "Boulangerie", "Auto-école", "Coiffeur", "Dentiste",
  "Comptable", "Avocat", "Architecte", "Agent immobilier",
];

export const CITIES = [
  // ── Île-de-France ─────────────────────────────────────────────────────────
  "Paris", "Boulogne-Billancourt", "Saint-Denis", "Argenteuil", "Montreuil",
  "Nanterre", "Vitry-sur-Seine", "Créteil", "Colombes", "Versailles",
  "Asnières-sur-Seine", "Courbevoie", "Rueil-Malmaison", "Champigny-sur-Marne",
  "Saint-Maur-des-Fossés", "Noisy-le-Grand", "Levallois-Perret",
  "Issy-les-Moulineaux", "Clichy", "Aubervilliers", "Ivry-sur-Seine",
  "Vincennes", "Fontenay-sous-Bois", "Villejuif", "Pantin", "Bobigny",
  "Aulnay-sous-Bois", "Bondy", "Drancy", "Épinay-sur-Seine", "Gennevilliers",
  "Clamart", "Sartrouville", "Maisons-Alfort", "Sarcelles", "Cergy",
  "Évry-Courcouronnes", "Massy", "Meaux", "Melun", "Corbeil-Essonnes",
  "Poissy", "Antony", "Chelles", "Mantes-la-Jolie", "Châtenay-Malabry",
  "Gagny", "Le Blanc-Mesnil", "Rosny-sous-Bois", "Châtillon",
  "Bagnolet", "La Courneuve", "Stains", "Villepinte", "Torcy",
  // ── Auvergne-Rhône-Alpes ──────────────────────────────────────────────────
  "Lyon", "Grenoble", "Saint-Étienne", "Villeurbanne", "Clermont-Ferrand",
  "Chambéry", "Annecy", "Bourg-en-Bresse", "Valence", "Vienne",
  "Roanne", "Oyonnax", "Romans-sur-Isère", "Montélimar", "Voiron",
  "Villefranche-sur-Saône", "Thonon-les-Bains", "Annemasse", "Cluses",
  "Mâcon", "Chalon-sur-Saône", "Aurillac", "Moulins", "Le Puy-en-Velay",
  // ── Provence-Alpes-Côte d'Azur ───────────────────────────────────────────
  "Marseille", "Nice", "Toulon", "Aix-en-Provence", "Avignon",
  "Antibes", "Cannes", "La Seyne-sur-Mer", "Hyères", "Fréjus",
  "Aubagne", "Martigues", "Salon-de-Provence", "Arles", "Grasse",
  "Menton", "Cagnes-sur-Mer", "Draguignan", "Manosque", "Marignane",
  "Six-Fours-les-Plages", "Orange", "Carpentras", "Gap", "Digne-les-Bains",
  // ── Occitanie ─────────────────────────────────────────────────────────────
  "Toulouse", "Montpellier", "Nîmes", "Perpignan", "Narbonne",
  "Sète", "Alès", "Béziers", "Albi", "Montauban", "Tarbes",
  "Castres", "Carcassonne", "Rodez", "Millau", "Agen", "Auch",
  "Cahors", "Mende", "Foix",
  // ── Nouvelle-Aquitaine ────────────────────────────────────────────────────
  "Bordeaux", "Limoges", "La Rochelle", "Pau", "Bayonne", "Mérignac",
  "Pessac", "Angoulême", "Périgueux", "Brive-la-Gaillarde",
  "Niort", "La Roche-sur-Yon", "Poitiers", "Châtellerault",
  "Rochefort", "Saintes", "Mont-de-Marsan", "Dax", "Agen", // (Agen partagé)
  "Guéret", "Tulle",
  // ── Grand Est ─────────────────────────────────────────────────────────────
  "Strasbourg", "Reims", "Metz", "Nancy", "Mulhouse", "Colmar",
  "Troyes", "Châlons-en-Champagne", "Thionville", "Forbach",
  "Haguenau", "Sarreguemines", "Épinal", "Saint-Dié-des-Vosges",
  "Montbéliard", "Belfort", "Vesoul", "Lons-le-Saunier",
  "Bar-le-Duc", "Verdun", "Saint-Dizier", "Lunéville", "Sélestat",
  // ── Hauts-de-France ───────────────────────────────────────────────────────
  "Lille", "Roubaix", "Tourcoing", "Valenciennes", "Dunkerque",
  "Calais", "Amiens", "Arras", "Douai", "Lens", "Béthune",
  "Boulogne-sur-Mer", "Maubeuge", "Cambrai", "Saint-Omer",
  "Soissons", "Compiègne", "Beauvais", "Creil", "Laon",
  // ── Normandie ─────────────────────────────────────────────────────────────
  "Rouen", "Le Havre", "Caen", "Cherbourg-en-Cotentin", "Évreux",
  "Alençon", "Dieppe", "Fécamp", "Lisieux", "Saint-Lô", "Bayeux",
  // ── Bretagne ──────────────────────────────────────────────────────────────
  "Rennes", "Brest", "Quimper", "Lorient", "Vannes", "Saint-Brieuc",
  "Saint-Malo", "Lannion", "Concarneau", "Vitré", "Fougères",
  // ── Pays de la Loire ──────────────────────────────────────────────────────
  "Nantes", "Angers", "Saint-Nazaire", "La Roche-sur-Yon", "Le Mans",
  "Laval", "Cholet", "Saint-Herblain", "Rezé", "Les Sables-d'Olonne",
  // ── Centre-Val de Loire ───────────────────────────────────────────────────
  "Orléans", "Tours", "Chartres", "Bourges", "Blois",
  "Châteauroux", "Vierzon", "Dreux", "Vendôme", "Montargis",
  // ── Bourgogne-Franche-Comté ───────────────────────────────────────────────
  "Dijon", "Besançon", "Chalon-sur-Saône", "Auxerre", "Nevers",
  "Montceau-les-Mines", "Le Creusot", "Sens", "Mâcon",
  // ── Corse ─────────────────────────────────────────────────────────────────
  "Ajaccio", "Bastia",
].filter((v, i, a) => a.indexOf(v) === i).sort();
