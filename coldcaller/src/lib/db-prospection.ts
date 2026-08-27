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
  assignedToId?: string;
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
    if (filter?.assignedToId) {
      params.push(filter.assignedToId);
      conds.push(`data->>'assignedToId' = $${params.length}`);
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

/** Récupère plusieurs prospects par leurs IDs en une seule requête. */
export async function dbGetProspectsByIds(ids: string[]): Promise<Map<string, Prospect>> {
  const map = new Map<string, Prospect>();
  if (!ids.length) return map;
  if (USE_PG) {
    await ensureTable();
    // Utilise l'opérateur = ANY() sur la clé primaire (indexed)
    const result = await pgQuery(
      `SELECT data FROM prospects WHERE id = ANY($1::text[])`,
      [ids]
    );
    for (const row of result.rows) {
      const p = (row as { data: Prospect }).data;
      map.set(p.id, p);
    }
  } else {
    for (const p of readJson()) {
      if (ids.includes(p.id)) map.set(p.id, p);
    }
  }
  return map;
}

export async function dbUpsertProspects(incoming: Prospect[], _userId?: string): Promise<void> {
  if (USE_PG) {
    await ensureTable();
    for (const p of incoming) {
      // MERGE intelligent : on insère les données SIRENE fraîches MAIS on préserve
      // tous les champs commerciaux déjà saisis (notes, statut appel, SDR, actions…).
      // jsonb_strip_nulls retire les clés null pour ne pas écraser avec null.
      await pgQuery(
        `INSERT INTO prospects (id, data) VALUES ($1, $2::jsonb)
         ON CONFLICT (id) DO UPDATE SET
           data = $2::jsonb || jsonb_strip_nulls(jsonb_build_object(
             'notesCommercial',   NULLIF(prospects.data->>'notesCommercial', ''),
             'problematique',     NULLIF(prospects.data->>'problematique', ''),
             'statutAppel',       NULLIF(NULLIF(prospects.data->>'statutAppel', 'non_appele'), ''),
             'statut',            NULLIF(NULLIF(prospects.data->>'statut', 'nouveau'), ''),
             'dateAppel',         prospects.data->>'dateAppel',
             'actions',           prospects.data->'actions',
             'assignedToId',      prospects.data->>'assignedToId',
             'assignedTo',        prospects.data->>'assignedTo',
             'danscrm',           NULLIF(prospects.data->>'danscrm', 'false')::boolean,
             'dateCrm',           prospects.data->>'dateCrm',
             'emailDirigeant',    NULLIF(prospects.data->>'emailDirigeant', ''),
             'emailSource',       NULLIF(prospects.data->>'emailSource', ''),
             'linkedinDirigeant', NULLIF(prospects.data->>'linkedinDirigeant', ''),
             'fonctionDirigeant', NULLIF(prospects.data->>'fonctionDirigeant', ''),
             'emailObjet',        NULLIF(prospects.data->>'emailObjet', ''),
             'emailCorps',        NULLIF(prospects.data->>'emailCorps', ''),
             'scoreQualif',       NULLIF(prospects.data->>'scoreQualif', ''),
             'lastEmailSentAt',   prospects.data->>'lastEmailSentAt',
             'telephonePro',      NULLIF(prospects.data->>'telephonePro', '')
           )),
           updated_at = NOW()`,
        [p.id, JSON.stringify(p)]
      );
    }
  } else {
    // JSON local : merge field-by-field, commercial fields win over SIRENE
    const existing = readJson();
    const map      = new Map(existing.map((p) => [p.id, p]));
    incoming.forEach((p) => {
      const ex = map.get(p.id);
      if (!ex) { map.set(p.id, p); return; }
      // Preserve commercial fields from existing, take SIRENE data for company info
      map.set(p.id, {
        ...p,
        notesCommercial:   ex.notesCommercial  || p.notesCommercial,
        problematique:     ex.problematique    || p.problematique,
        statutAppel:       (ex.statutAppel && ex.statutAppel !== "non_appele") ? ex.statutAppel : p.statutAppel,
        statut:            (ex.statut && ex.statut !== "nouveau") ? ex.statut : p.statut,
        dateAppel:         ex.dateAppel        || p.dateAppel,
        actions:           ex.actions?.length  ? ex.actions : p.actions,
        assignedToId:      ex.assignedToId     || p.assignedToId,
        assignedTo:        ex.assignedTo       || p.assignedTo,
        danscrm:           ex.danscrm          ?? p.danscrm,
        dateCrm:           ex.dateCrm          || p.dateCrm,
        emailDirigeant:    ex.emailDirigeant   || p.emailDirigeant,
        linkedinDirigeant: ex.linkedinDirigeant || p.linkedinDirigeant,
        telephonePro:      ex.telephonePro     || p.telephonePro,
      });
    });
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
