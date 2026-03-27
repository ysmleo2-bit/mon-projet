// Unified DB client
// Production (Turso): direct HTTP v2/pipeline — bypasses @libsql/client entirely
// Local dev (SQLite file): @libsql/client with file: URL (no store_sql issue here)
import path from 'path'
import { fileURLToPath } from 'url'

export type Row = Record<string, string | number | boolean | null>

function isLocalDb(): boolean {
  const url = process.env.DATABASE_URL
  return !url || url.startsWith('file:')
}

// ─── Production: Turso HTTP v2/pipeline ──────────────────────────────────────

function encodeArg(v: unknown): Record<string, string> {
  if (v === null || v === undefined) return { type: 'null' }
  if (typeof v === 'boolean') return { type: 'integer', value: v ? '1' : '0' }
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return { type: 'integer', value: String(v) }
    return { type: 'float', value: String(v) }
  }
  return { type: 'text', value: String(v) }
}

async function tursoBatch(stmts: { sql: string; args?: unknown[] }[]): Promise<Row[][]> {
  const rawUrl = process.env.DATABASE_URL!
  const url = rawUrl.replace(/^libsql:\/\//, 'https://')
  const token = process.env.TURSO_AUTH_TOKEN ?? ''

  const requests = [
    ...stmts.map(s => ({
      type: 'execute',
      stmt: { sql: s.sql, args: (s.args ?? []).map(encodeArg) },
    })),
    { type: 'close' },
  ]

  const res = await fetch(`${url}/v2/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Turso HTTP ${res.status}: ${text}`)
  }

  const data = (await res.json()) as {
    results: Array<{
      type: string
      response?: { type: string; result?: { cols: { name: string }[]; rows: unknown[][] } }
      error?: { message?: string }
    }>
  }

  for (const r of data.results ?? []) {
    if (r.type === 'error') {
      throw new Error(`Turso error: ${r.error?.message ?? 'unknown'}`)
    }
  }

  return data.results
    .filter(r => r.type === 'ok' && r.response?.type === 'execute')
    .map(r => {
      const { cols, rows } = r.response!.result!
      return rows.map(row =>
        Object.fromEntries(cols.map((col, i) => [col.name, row[i] ?? null])) as Row
      )
    })
}

// ─── Local: @libsql/client with SQLite file ───────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _localClient: any

async function getLocalClient() {
  if (_localClient) return _localClient
  const { createClient } = await import('@libsql/client')
  const thisDir = path.dirname(fileURLToPath(import.meta.url))
  const absDb = path.resolve(thisDir, '..', '..', 'prisma', 'dev.db')
  _localClient = createClient({ url: `file://${absDb}` })
  return _localClient
}

function localResultToRows(result: { columns: string[]; rows: unknown[][] }): Row[] {
  return result.rows.map(row =>
    Object.fromEntries(
      result.columns.map((col, i) => [col, (row as unknown[])[i] ?? null])
    ) as Row
  )
}

async function localBatch(stmts: { sql: string; args?: unknown[] }[]): Promise<Row[][]> {
  const client = await getLocalClient()
  const results = await client.batch(
    stmts.map(s => ({ sql: s.sql, args: s.args ?? [] })),
    'write'
  )
  return results.map(localResultToRows)
}

async function localQuery(sql: string, args: unknown[] = []): Promise<Row[]> {
  const client = await getLocalClient()
  const result = await client.execute({ sql, args })
  return localResultToRows(result)
}

// ─── Unified exports ──────────────────────────────────────────────────────────

export async function query(sql: string, args: unknown[] = []): Promise<Row[]> {
  if (isLocalDb()) return localQuery(sql, args)
  const [result] = await tursoBatch([{ sql, args }])
  return result
}

export async function batch(stmts: { sql: string; args?: unknown[] }[]): Promise<Row[][]> {
  if (isLocalDb()) return localBatch(stmts)
  return tursoBatch(stmts)
}
