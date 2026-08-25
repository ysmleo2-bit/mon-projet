/**
 * db-prospection.ts — persistance des prospects B2B
 * Même pattern que db.ts : Neon Postgres (prod) ou JSON local (dev)
 */

import type { Prospect, ProspectStatut } from "@/lib/types-prospection";

interface PgResult { rows: Record<string, unknown>[]; rowCount: number }

async function pgQuery(sql: string, params: unknown[] = []): Promise<PgResult> {
  const { neon } = await import("@neondatabase/serverless");
  const db  = neon(process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? "");
  // neon tagged template (sql`...`) returns rows[] directly.
  // neon.query(text, params) returns a QueryResult { rows, rowCount }.
  // We normalise both shapes so callers always get { rows, rowCount }.
  const res = await db.query(sql, params) as unknown;
  if (Array.isArray(res)) {
    return { rows: res as Record<string, unknown>[], rowCount: (res as unknown[]).length };
  }
  const qr = res as { rows?: Record<string, unknown>[]; rowCount?: number };
  return {
    rows:     qr.rows     ?? [],
    rowCount: qr.rowCount ?? 0,
  };
}

async function ensureTable() {
  await pgQuery(`
    CREATE TABLE IF NOT EXISTS prospects (
      id          TEXT PRIMARY KEY,
      data        JSONB NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

// ── JSON local (dev) ──────────────────────────────────────────────────────────
function localPath() {
  const path = require("path") as typeof import("path");
  return path.join(process.cwd(), "data", "prospects.json");
}

function readJson(): Prospect[] {
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

function writeJson(items: Prospect[]) {
  const fs = require("fs") as typeof import("fs");
  fs.writeFileSync(localPath(), JSON.stringify(items, null, 2));
}

const USE_PG = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL);

// ── API publique ──────────────────────────────────────────────────────────────
export async function dbGetProspects(filter?: {
  statut?: ProspectStatut;
  secteur?: string;
  departement?: string;
  userId?: string;
}): Promise<Prospect[]> {
  if (USE_PG) {
    await ensureTable();
    let sql = "SELECT data FROM prospects";
    const params: string[] = [];
    const conds: string[]  = [];
    if (filter?.statut) {
      params.push(filter.statut);
      conds.push(`data->>'statut' = $${params.length}`);
    }
    if (filter?.secteur) {
      params.push(`%${filter.secteur}%`);
      conds.push(`data->>'secteur' ILIKE $${params.length}`);
    }
    if (filter?.userId) {
      params.push(filter.userId);
      conds.push(`user_id = $${params.length}`);
    }
    if (conds.length) sql += " WHERE " + conds.join(" AND ");
    sql += " ORDER BY updated_at DESC LIMIT 500";
    const result = await pgQuery(sql, params);
    return result.rows.map((r) => (r as { data: Prospect }).data);
  } else {
    let items = readJson();
    if (filter?.statut)      items = items.filter((p) => p.statut === filter.statut);
    if (filter?.secteur)     items = items.filter((p) => p.secteur?.toLowerCase().includes(filter.secteur!.toLowerCase()));
    if (filter?.departement) items = items.filter((p) => p.departement === filter.departement);
    return items;
  }
}

export async function dbGetProspect(id: string): Promise<Prospect | undefined> {
  if (USE_PG) {
    await ensureTable();
    const result = await pgQuery("SELECT data FROM prospects WHERE id = $1", [id]);
    return (result.rows[0] as { data: Prospect } | undefined)?.data;
  } else {
    return readJson().find((p) => p.id === id);
  }
}

export async function dbUpsertProspects(incoming: Prospect[], userId?: string): Promise<void> {
  if (USE_PG) {
    await ensureTable();
    for (const p of incoming) {
      if (userId) {
        await pgQuery(
          `INSERT INTO prospects (id, data, user_id) VALUES ($1, $2, $3)
           ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = NOW()`,
          [p.id, JSON.stringify(p), userId]
        );
      } else {
        await pgQuery(
          `INSERT INTO prospects (id, data) VALUES ($1, $2)
           ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = NOW()`,
          [p.id, JSON.stringify(p)]
        );
      }
    }
  } else {
    const existing = readJson();
    const map      = new Map(existing.map((p) => [p.id, p]));
    incoming.forEach((p) => map.set(p.id, { ...map.get(p.id), ...p }));
    writeJson(Array.from(map.values()));
  }
}

export async function dbUpdateProspect(id: string, patch: Partial<Prospect>): Promise<Prospect> {
  if (USE_PG) {
    await ensureTable();
    const existing = await dbGetProspect(id);
    // Upsert: if the prospect doesn't exist yet (e.g. DB save was fire-and-forget
    // and failed), create a minimal record so the enrichment data is not lost.
    const base: Prospect = existing ?? ({
      id,
      siren:      patch.siren      ?? "",
      nom:        patch.nom        ?? id,
      codeNaf:    patch.codeNaf    ?? "",
      libelleNaf: patch.libelleNaf ?? "",
      secteur:    patch.secteur    ?? "",
      adresse:    patch.adresse    ?? "",
      dirigeants: [],
      statut:     "nouveau",
      sources:    ["sirene"],
      actions:    [],
      createdAt:  new Date().toISOString(),
      updatedAt:  new Date().toISOString(),
    } as unknown as Prospect);
    const updated = { ...base, ...patch, updatedAt: new Date().toISOString() };
    await pgQuery(
      `INSERT INTO prospects (id, data) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = NOW()`,
      [id, JSON.stringify(updated)]
    );
    return updated;
  } else {
    const items = readJson();
    const idx   = items.findIndex((p) => p.id === id);
    if (idx === -1) {
      // Upsert: create if not found
      const newProspect: Prospect = {
        id,
        siren:      patch.siren      ?? "",
        nom:        patch.nom        ?? id,
        codeNaf:    patch.codeNaf    ?? "",
        libelleNaf: patch.libelleNaf ?? "",
        secteur:    patch.secteur    ?? "",
        adresse:    patch.adresse    ?? "",
        statut:     "nouveau",
        sources:    ["sirene"],
        actions:    [],
        createdAt:  new Date().toISOString(),
        updatedAt:  new Date().toISOString(),
        ...patch,
      } as Prospect;
      items.push(newProspect);
      writeJson(items);
      return newProspect;
    }
    items[idx] = { ...items[idx], ...patch, updatedAt: new Date().toISOString() };
    writeJson(items);
    return items[idx];
  }
}

export async function dbDeleteProspect(id: string): Promise<boolean> {
  if (USE_PG) {
    await ensureTable();
    const result = await pgQuery("DELETE FROM prospects WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  } else {
    const items = readJson();
    const next  = items.filter((p) => p.id !== id);
    if (next.length === items.length) return false;
    writeJson(next);
    return true;
  }
}
