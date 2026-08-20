/**
 * db-scripts.ts — Dual-mode DB layer pour les scripts d'appel
 * Même pattern que db-templates.ts : Neon Postgres en prod, JSON en dev
 */

const USE_PG = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL);
const JSON_PATH = "data/call-scripts.json";

export interface CallScriptSection {
  id:      string;
  title:   string;
  content: string;
  color:   "blue" | "violet" | "amber" | "emerald" | "rose" | "teal" | "gray";
}

const DEFAULT_SECTIONS: CallScriptSection[] = [
  {
    id:    "accroche",
    title: "🎯 Accroche",
    color: "blue",
    content:
`Bonjour, je suis bien en ligne avec [NOM] de [NOM_ENTREPRISE] ?

Je me présente : [VOTRE NOM] de [VOTRE SOCIÉTÉ]. Je vous contacte car votre entreprise intervient dans [SECTEUR] et j'avais une question rapide — ça prend 2 minutes.

Est-ce que vous cherchez à développer votre clientèle en ce moment ?`,
  },
  {
    id:    "detection",
    title: "🔍 Détection des besoins",
    color: "amber",
    content:
`[ÉCOUTER ATTENTIVEMENT]

Questions à poser :
• Comment trouvez-vous vos clients actuellement ?
• Quel est votre principal défi pour trouver de nouveaux chantiers / contrats ?
• Combien de temps passez-vous à prospecter chaque semaine ?

→ Reformuler : « Donc si je comprends bien, le principal problème c'est [PROBLÈME] — c'est bien ça ? »`,
  },
  {
    id:    "argumentation",
    title: "💡 Argumentation",
    color: "emerald",
    content:
`C'est exactement pour ça que je vous appelle.

Notre solution ColdCaller permet aux [SECTEUR] comme vous de :
✓ Trouver 500 prospects qualifiés avec numéros directs en 10 minutes
✓ Automatiser les emails de prospection personnalisés
✓ Suivre tous vos leads dans un CRM intégré

Des artisans comme vous gagnent en moyenne [X] nouveaux clients par mois grâce à ça.`,
  },
  {
    id:    "objections",
    title: "🛡️ Gestion des objections",
    color: "rose",
    content:
`« Pas intéressé »
→ Je comprends. Juste pour ma curiosité : si on pouvait vous montrer 20 prospects qualifiés dans votre zone cette semaine, sans engagement — ça vaudrait 15 minutes de votre temps ?

« C'est trop cher »
→ Qu'est-ce que vous entendez par cher ? Notre offre débute à 19€/mois. Combien vous rapporte un nouveau client ?

« Je n'ai pas le temps »
→ Exactement le problème qu'on résout ! Je peux vous rappeler quand c'est plus calme — mardi matin ou jeudi après-midi, ça vous irait ?

« J'ai déjà quelqu'un »
→ C'est bien ! Notre outil est complémentaire — il fait le travail de recherche que personne n'a le temps de faire.`,
  },
  {
    id:    "conclusion",
    title: "📅 Conclusion / Prise de RDV",
    color: "teal",
    content:
`Super, on est alignés.

Ce que je vous propose : une démo de 20 minutes en visio pour vous montrer concrètement comment ça fonctionne sur votre secteur à [VILLE].

Vous seriez disponible [JOUR OPTION 1] ou [JOUR OPTION 2] ?

Parfait ! Je vous envoie l'invitation sur [EMAIL] — vous pouvez me le confirmer ?

À [JOUR] à [HEURE] alors. Bonne journée !`,
  },
];

// ── Neon PG backend ───────────────────────────────────────────────────────────
async function ensureTable() {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.POSTGRES_URL || process.env.DATABASE_URL!);
  await sql`
    CREATE TABLE IF NOT EXISTS call_scripts (
      key        TEXT PRIMARY KEY,
      sections   JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  return sql;
}

// ── JSON fallback ─────────────────────────────────────────────────────────────
async function readJson(): Promise<CallScriptSection[]> {
  try {
    const { readFileSync } = await import("fs");
    return JSON.parse(readFileSync(JSON_PATH, "utf-8")) as CallScriptSection[];
  } catch {
    return [...DEFAULT_SECTIONS];
  }
}

async function writeJson(sections: CallScriptSection[]) {
  const { writeFileSync, mkdirSync } = await import("fs");
  mkdirSync("data", { recursive: true });
  writeFileSync(JSON_PATH, JSON.stringify(sections, null, 2), "utf-8");
}

// ── API publique ──────────────────────────────────────────────────────────────

export async function dbGetCallScript(): Promise<CallScriptSection[]> {
  if (USE_PG) {
    try {
      const sql = await ensureTable();
      const rows = await sql`SELECT sections FROM call_scripts WHERE key = 'default'`;
      if (rows.length > 0) return rows[0].sections as CallScriptSection[];
    } catch { /* fall through to defaults */ }
  } else {
    return readJson();
  }
  return [...DEFAULT_SECTIONS];
}

export async function dbSaveCallScript(sections: CallScriptSection[]): Promise<void> {
  if (USE_PG) {
    try {
      const sql = await ensureTable();
      await sql`
        INSERT INTO call_scripts (key, sections, updated_at)
        VALUES ('default', ${JSON.stringify(sections)}, NOW())
        ON CONFLICT (key) DO UPDATE SET sections = ${JSON.stringify(sections)}, updated_at = NOW()
      `;
    } catch (e) {
      console.warn("[db-scripts] save failed:", e);
    }
  } else {
    await writeJson(sections);
  }
}
