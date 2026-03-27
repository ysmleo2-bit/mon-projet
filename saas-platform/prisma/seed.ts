import 'dotenv/config'
import bcrypt from 'bcryptjs'
import path from 'path'
import { fileURLToPath } from 'url'

// ─── Minimal DB client (mirrors src/lib/db.ts logic) ─────────────────────────

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

type Row = Record<string, unknown>

function isLocalDb(): boolean {
  const url = process.env.DATABASE_URL
  return !url || url.startsWith('file:')
}

function encodeArg(v: unknown): Record<string, string> {
  if (v === null || v === undefined) return { type: 'null' }
  if (typeof v === 'boolean') return { type: 'integer', value: v ? '1' : '0' }
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return { type: 'integer', value: String(v) }
    return { type: 'float', value: String(v) }
  }
  return { type: 'text', value: String(v) }
}

async function tursoExec(sql: string, args: unknown[] = []): Promise<Row[]> {
  const rawUrl = process.env.DATABASE_URL!
  const url = rawUrl.replace(/^libsql:\/\//, 'https://')
  const token = process.env.TURSO_AUTH_TOKEN ?? ''

  const res = await fetch(`${url}/v2/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [
        { type: 'execute', stmt: { sql, args: args.map(encodeArg) } },
        { type: 'close' },
      ],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Turso HTTP ${res.status}: ${text}`)
  }

  const data = await res.json() as { results: Array<{ type: string; response?: { type: string; result?: { cols: { name: string }[]; rows: unknown[][] } }; error?: { message?: string } }> }

  for (const r of data.results ?? []) {
    if (r.type === 'error') throw new Error(`Turso error: ${r.error?.message ?? 'unknown'}`)
  }

  const execResult = data.results.find(r => r.type === 'ok' && r.response?.type === 'execute')
  if (!execResult?.response?.result) return []

  const { cols, rows } = execResult.response.result
  return rows.map(row =>
    Object.fromEntries(cols.map((col, i) => [col.name, row[i] ?? null]))
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _localClient: any

async function localExec(sql: string, args: unknown[] = []): Promise<Row[]> {
  if (!_localClient) {
    const { createClient } = await import('@libsql/client')
    const absDb = path.resolve(__dirname, 'dev.db')
    _localClient = createClient({ url: `file://${absDb}` })
  }
  const result = await _localClient.execute({ sql, args })
  return result.rows.map((row: unknown[]) =>
    Object.fromEntries(result.columns.map((col: string, i: number) => [col, row[i] ?? null]))
  )
}

async function exec(sql: string, args: unknown[] = []): Promise<Row[]> {
  if (isLocalDb()) return localExec(sql, args)
  return tursoExec(sql, args)
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const setters = [
  {
    email: 'alice@example.com',
    name: 'Alice Martin',
    title: 'Experte en cold calling B2B',
    bio: "5 ans d'expérience en prise de RDV pour des entreprises SaaS. Spécialisée dans le secteur tech et finance. Taux de conversion moyen de 35%.",
    skills: ['Cold calling', 'LinkedIn outreach', 'CRM', 'Prospection B2B', 'Salesforce'],
    hourlyRate: 35,
    location: 'Paris, France',
  },
  {
    email: 'thomas@example.com',
    name: 'Thomas Bernard',
    title: 'Setter LinkedIn & email marketing',
    bio: "Je génère 15-20 RDV qualifiés par semaine grâce à des séquences LinkedIn et email personnalisées. Expérience dans le B2B SaaS, consulting et formation.",
    skills: ['LinkedIn outreach', 'Email marketing', 'Copywriting', 'Automation', 'HubSpot'],
    hourlyRate: 40,
    location: 'Lyon, France',
  },
  {
    email: 'sarah@example.com',
    name: 'Sarah Dubois',
    title: 'SDR Senior - Marché SME',
    bio: "Ancienne SDR chez 2 scale-ups, je maîtrise la prospection multicanal. J'aide les startups à structurer leur processus de qualification et à remplir leur pipeline.",
    skills: ['Lead generation', 'Qualification', 'Sales funnel', 'Outbound', 'Pipedrive'],
    hourlyRate: 45,
    location: 'Bordeaux, France',
  },
]

const entrepreneurs = [
  {
    email: 'marc@example.com',
    name: 'Marc Leroy',
    title: 'CEO & Fondateur - SaaS RH',
    bio: "Je dirige une startup SaaS dans les RH avec 50 clients. Je cherche un setter pour scaler notre acquisition B2B et atteindre 200 clients d'ici fin d'année.",
    skills: ['SaaS', 'B2B', 'RH', 'Scaling', 'Fundraising'],
    location: 'Paris, France',
  },
  {
    email: 'julie@example.com',
    name: 'Julie Fontaine',
    title: 'Consultante en transformation digitale',
    bio: "Consultante indépendante depuis 3 ans, j'accompagne des PME dans leur transformation digitale. Je recherche un setter expérimenté pour développer mon portefeuille client.",
    skills: ['Transformation digitale', 'Coaching', 'PME', 'Formation', 'Stratégie'],
    location: 'Nantes, France',
  },
]

async function main() {
  console.log('Seeding database...')
  const password = await bcrypt.hash('password123', 10)
  const now = new Date().toISOString()

  for (const s of setters) {
    const existing = await exec('SELECT id FROM "User" WHERE email = ?', [s.email])
    if (existing.length > 0) {
      console.log(`  skip ${s.email} (already exists)`)
      continue
    }
    const userId = crypto.randomUUID()
    const profileId = crypto.randomUUID()
    await exec(
      'INSERT INTO "User" (id, email, password, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, s.email, password, 'setter', now, now]
    )
    await exec(
      'INSERT INTO "Profile" (id, userId, name, title, bio, skills, hourlyRate, location, available, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
      [profileId, userId, s.name, s.title, s.bio, JSON.stringify(s.skills), s.hourlyRate, s.location, now, now]
    )
    console.log(`  created setter: ${s.email}`)
  }

  for (const e of entrepreneurs) {
    const existing = await exec('SELECT id FROM "User" WHERE email = ?', [e.email])
    if (existing.length > 0) {
      console.log(`  skip ${e.email} (already exists)`)
      continue
    }
    const userId = crypto.randomUUID()
    const profileId = crypto.randomUUID()
    await exec(
      'INSERT INTO "User" (id, email, password, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, e.email, password, 'entrepreneur', now, now]
    )
    await exec(
      'INSERT INTO "Profile" (id, userId, name, title, bio, skills, hourlyRate, location, available, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 1, ?, ?)',
      [profileId, userId, e.name, e.title, e.bio, JSON.stringify(e.skills), e.location, now, now]
    )
    console.log(`  created entrepreneur: ${e.email}`)
  }

  console.log('Done! password: password123')
}

main().catch(e => { console.error(e); process.exit(1) })
