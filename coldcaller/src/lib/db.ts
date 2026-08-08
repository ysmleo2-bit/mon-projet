/**
 * db.ts — abstraction de base de données
 * • En production (POSTGRES_URL défini) : Neon Postgres
 * • En développement local (pas de POSTGRES_URL) : fichier JSON local
 */

import type { Lead } from "@/lib/types";

// ── Helpers partagés ─────────────────────────────────────────────────────────
function newId() {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Implémentation Postgres (Neon) ────────────────────────────────────────────
interface PgResult { rows: Record<string, unknown>[]; rowCount: number }

async function pgQuery(sql: string, params: unknown[] = []): Promise<PgResult> {
  const { neon } = await import("@neondatabase/serverless");
  const db  = neon(process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? "");
  const res = await db.query(sql, params);
  // neon() returns NeonQueryResult which has rows + rowCount
  return res as unknown as PgResult;
}

async function ensureTable() {
  await pgQuery(`
    CREATE TABLE IF NOT EXISTS leads (
      id          TEXT PRIMARY KEY,
      data        JSONB NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

// ── Implémentation JSON locale ────────────────────────────────────────────────
function localPath() {
  const path = require("path") as typeof import("path");
  return path.join(process.cwd(), "data", "leads.json");
}

function readJson(): Lead[] {
  const fs   = require("fs") as typeof import("fs");
  const path = localPath();
  if (!fs.existsSync(path)) {
    fs.mkdirSync(require("path").dirname(path), { recursive: true });
    fs.writeFileSync(path, "[]");
    return [];
  }
  try { return JSON.parse(fs.readFileSync(path, "utf-8")); }
  catch { return []; }
}

function writeJson(leads: Lead[]) {
  const fs = require("fs") as typeof import("fs");
  fs.writeFileSync(localPath(), JSON.stringify(leads, null, 2));
}

// ── Détection du mode ─────────────────────────────────────────────────────────
const USE_PG = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL);

// ── API publique ──────────────────────────────────────────────────────────────

export async function dbGetLeads(filter?: { status?: string; category?: string }): Promise<Lead[]> {
  if (USE_PG) {
    await ensureTable();
    let sql = "SELECT data FROM leads";
    const params: string[] = [];
    const conds: string[]  = [];
    if (filter?.status) {
      params.push(filter.status);
      conds.push(`data->>'status' = $${params.length}`);
    }
    if (filter?.category) {
      params.push(filter.category);
      conds.push(`data->>'category' = $${params.length}`);
    }
    if (conds.length) sql += " WHERE " + conds.join(" AND ");
    sql += " ORDER BY created_at DESC";
    const result = await pgQuery(sql, params);
    return result.rows.map((r) => (r as { data: Lead }).data);
  } else {
    let leads = readJson();
    if (filter?.status)   leads = leads.filter((l) => l.status === filter.status);
    if (filter?.category) leads = leads.filter((l) => l.category === filter.category);
    return leads;
  }
}

export async function dbGetLead(id: string): Promise<Lead | undefined> {
  if (USE_PG) {
    await ensureTable();
    const result = await pgQuery("SELECT data FROM leads WHERE id = $1", [id]);
    return (result.rows[0] as { data: Lead } | undefined)?.data;
  } else {
    return readJson().find((l) => l.id === id);
  }
}

export async function dbUpsertLeads(incoming: Lead[]): Promise<Lead[]> {
  if (USE_PG) {
    await ensureTable();
    for (const lead of incoming) {
      await pgQuery(
        `INSERT INTO leads (id, data) VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = NOW()`,
        [lead.id, JSON.stringify(lead)]
      );
    }
    return incoming;
  } else {
    const existing = readJson();
    const map      = new Map(existing.map((l) => [l.id, l]));
    incoming.forEach((l) => map.set(l.id, { ...map.get(l.id), ...l }));
    const result = Array.from(map.values());
    writeJson(result);
    return incoming;
  }
}

export async function dbUpdateLead(id: string, patch: Partial<Lead>): Promise<Lead | null> {
  if (USE_PG) {
    await ensureTable();
    const existing = await dbGetLead(id);
    if (!existing) return null;
    const updated  = { ...existing, ...patch };
    await pgQuery(
      `UPDATE leads SET data = $2, updated_at = NOW() WHERE id = $1`,
      [id, JSON.stringify(updated)]
    );
    return updated;
  } else {
    const leads   = readJson();
    const idx     = leads.findIndex((l) => l.id === id);
    if (idx === -1) return null;
    leads[idx]    = { ...leads[idx], ...patch };
    writeJson(leads);
    return leads[idx];
  }
}

export async function dbDeleteLead(id: string): Promise<boolean> {
  if (USE_PG) {
    await ensureTable();
    const result = await pgQuery("DELETE FROM leads WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  } else {
    const leads = readJson();
    const next  = leads.filter((l) => l.id !== id);
    if (next.length === leads.length) return false;
    writeJson(next);
    return true;
  }
}

export async function dbAddLead(partial: Partial<Lead>): Promise<Lead> {
  const lead: Lead = {
    id:          partial.id ?? newId(),
    name:        partial.name ?? "",
    category:    partial.category ?? "",
    phone:       partial.phone ?? "",
    address:     partial.address ?? "",
    city:        partial.city ?? "",
    rating:      partial.rating ?? 0,
    reviewCount: partial.reviewCount ?? 0,
    website:     partial.website,
    email:       partial.email,
    status:      partial.status ?? "new",
    notes:       partial.notes ?? "",
    source:      partial.source ?? "manual",
    detectedAt:  partial.detectedAt ?? new Date().toISOString(),
    callCount:   partial.callCount ?? 0,
  };
  await dbUpsertLeads([lead]);
  return lead;
}
