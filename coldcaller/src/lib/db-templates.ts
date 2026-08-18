/**
 * db-templates.ts — Dual-mode DB layer pour les modèles d'emails
 * Même pattern que db.ts : Neon Postgres en prod, fichier JSON en dev
 */

const USE_PG = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL);
const JSON_PATH = "data/email-templates.json";

// ── Type ──────────────────────────────────────────────────────────────────────
export interface EmailTemplate {
  id:        string;
  name:      string;      // ex: "Prospection initiale"
  subject:   string;      // peut contenir {{variables}}
  body:      string;      // corps de l'email avec {{variables}}
  variables: string[];    // ex: ["nom", "ville", "dirigeant"]
  createdAt: string;
  updatedAt: string;
}

// Détecte les variables {{...}} dans subject + body
function detectVariables(subject: string, body: string): string[] {
  const re = /\{\{([^}]+)\}\}/g;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  for (const text of [subject, body]) {
    const clone = new RegExp(re.source, re.flags);
    while ((m = clone.exec(text)) !== null) found.add(m[1].trim());
  }
  return Array.from(found);
}

function genId(): string {
  return `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Templates par défaut ──────────────────────────────────────────────────────
const DEFAULT_TEMPLATES: EmailTemplate[] = [
  {
    id:        "tpl-default-1",
    name:      "Prospection initiale",
    subject:   "{{nom}} — Une question rapide",
    body:      `Bonjour {{dirigeant}},

J'ai découvert {{nom}} et je voulais vous contacter directement.

Beaucoup d'entreprises dans votre secteur à {{ville}} peinent à trouver de nouveaux clients de manière régulière. Est-ce que c'est un défi que vous rencontrez également ?

Je propose des solutions d'automatisation commerciale (IA de prospection, enrichissement de leads, emails personnalisés) qui permettent à des dirigeants comme vous de gagner du temps et de développer leur chiffre d'affaires.

Seriez-vous disponible 15 minutes cette semaine pour en discuter ?

Cordialement`,
    variables: ["nom", "dirigeant", "ville"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id:        "tpl-default-2",
    name:      "Relance (J+7)",
    subject:   "Retour sur mon message — {{nom}}",
    body:      `Bonjour {{dirigeant}},

Je me permets de revenir vers vous suite à mon message de la semaine dernière concernant {{nom}}.

Mon offre d'automatisation commerciale est toujours d'actualité. Je serais ravi d'échanger quelques minutes avec vous.

Avez-vous un créneau cette semaine ?

Cordialement`,
    variables: ["nom", "dirigeant"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id:        "tpl-default-3",
    name:      "Présentation IA — court",
    subject:   "Automatiser l'acquisition client de {{nom}}",
    body:      `Bonjour {{dirigeant}},

{{nom}} à {{ville}} — j'ai pris le temps d'analyser votre activité dans le secteur {{secteur}}.

En quelques mots : je développe des agents IA qui automatisent la prospection commerciale — recherche de leads, envoi d'emails personnalisés, relances automatiques.

Résultat : plus de clients, moins de temps passé à prospecter.

15 minutes cette semaine pour vous montrer concrètement ?

Cordialement`,
    variables: ["nom", "dirigeant", "ville", "secteur"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// ── Postgres backend ──────────────────────────────────────────────────────────
async function ensureTable() {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.POSTGRES_URL || process.env.DATABASE_URL!);
  await sql`
    CREATE TABLE IF NOT EXISTS email_templates (
      id   TEXT PRIMARY KEY,
      data JSONB NOT NULL
    )
  `;
  // Seeder : insérer les templates par défaut si la table est vide
  const rows = await sql`SELECT id FROM email_templates LIMIT 1`;
  if (rows.length === 0) {
    for (const tpl of DEFAULT_TEMPLATES) {
      await sql`INSERT INTO email_templates (id, data) VALUES (${tpl.id}, ${JSON.stringify(tpl)})`;
    }
  }
  return sql;
}

// ── JSON fallback ─────────────────────────────────────────────────────────────
async function readJson(): Promise<EmailTemplate[]> {
  try {
    const { readFileSync } = await import("fs");
    const raw = readFileSync(JSON_PATH, "utf-8");
    return JSON.parse(raw) as EmailTemplate[];
  } catch {
    return [...DEFAULT_TEMPLATES];
  }
}

async function writeJson(templates: EmailTemplate[]) {
  const { writeFileSync, mkdirSync } = await import("fs");
  mkdirSync("data", { recursive: true });
  writeFileSync(JSON_PATH, JSON.stringify(templates, null, 2), "utf-8");
}

// ── API publique ──────────────────────────────────────────────────────────────

export async function dbGetTemplates(): Promise<EmailTemplate[]> {
  if (USE_PG) {
    const sql = await ensureTable();
    const rows = await sql`SELECT data FROM email_templates ORDER BY (data->>'createdAt') ASC`;
    return rows.map((r) => r.data as EmailTemplate);
  }
  return readJson();
}

export async function dbGetTemplate(id: string): Promise<EmailTemplate | null> {
  if (USE_PG) {
    const sql = await ensureTable();
    const rows = await sql`SELECT data FROM email_templates WHERE id = ${id}`;
    return rows.length ? (rows[0].data as EmailTemplate) : null;
  }
  const all = await readJson();
  return all.find((t) => t.id === id) ?? null;
}

export async function dbCreateTemplate(
  partial: Omit<EmailTemplate, "id" | "createdAt" | "updatedAt" | "variables">
): Promise<EmailTemplate> {
  const now = new Date().toISOString();
  const tpl: EmailTemplate = {
    id:        genId(),
    ...partial,
    variables: detectVariables(partial.subject, partial.body),
    createdAt: now,
    updatedAt: now,
  };
  if (USE_PG) {
    const sql = await ensureTable();
    await sql`INSERT INTO email_templates (id, data) VALUES (${tpl.id}, ${JSON.stringify(tpl)})`;
    return tpl;
  }
  const all = await readJson();
  all.push(tpl);
  await writeJson(all);
  return tpl;
}

export async function dbUpdateTemplate(
  id: string,
  patch: Partial<Omit<EmailTemplate, "id" | "createdAt">>
): Promise<EmailTemplate> {
  const existing = await dbGetTemplate(id);
  if (!existing) throw new Error(`Template ${id} not found`);

  const updated: EmailTemplate = {
    ...existing,
    ...patch,
    id,
    updatedAt:  new Date().toISOString(),
    variables:  detectVariables(patch.subject ?? existing.subject, patch.body ?? existing.body),
  };

  if (USE_PG) {
    const sql = await ensureTable();
    await sql`UPDATE email_templates SET data = ${JSON.stringify(updated)} WHERE id = ${id}`;
    return updated;
  }
  const all = await readJson();
  const idx = all.findIndex((t) => t.id === id);
  if (idx >= 0) all[idx] = updated; else all.push(updated);
  await writeJson(all);
  return updated;
}

export async function dbDeleteTemplate(id: string): Promise<boolean> {
  if (USE_PG) {
    const sql = await ensureTable();
    await sql`DELETE FROM email_templates WHERE id = ${id}`;
    return true;
  }
  const all = await readJson();
  const filtered = all.filter((t) => t.id !== id);
  if (filtered.length === all.length) return false;
  await writeJson(filtered);
  return true;
}
