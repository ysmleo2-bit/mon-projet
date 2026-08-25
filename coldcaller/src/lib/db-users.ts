/**
 * db-users.ts — gestion des comptes utilisateurs
 *
 * Table `users` :
 *   id            TEXT PRIMARY KEY (UUID v4)
 *   email         TEXT UNIQUE NOT NULL
 *   name          TEXT NOT NULL
 *   role          TEXT NOT NULL  -- 'admin' | 'sdr'
 *   password_hash TEXT NOT NULL
 *   active        BOOLEAN DEFAULT true
 *   created_at    TIMESTAMPTZ DEFAULT NOW()
 *   updated_at    TIMESTAMPTZ DEFAULT NOW()
 */

import type { UserRole } from "@/lib/auth";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface DbUser {
  id:            string;
  email:         string;
  name:          string;
  role:          UserRole;
  password_hash: string;
  active:        boolean;
  created_at:    string;
  updated_at:    string;
}

export type PublicUser = Omit<DbUser, "password_hash">;

// ── pgQuery helper ────────────────────────────────────────────────────────────
interface PgResult { rows: Record<string, unknown>[]; rowCount: number }

async function pgQuery(sql: string, params: unknown[] = []): Promise<PgResult> {
  const { neon } = await import("@neondatabase/serverless");
  const db  = neon(process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? "");
  const res = await db.query(sql, params) as unknown;
  if (Array.isArray(res)) return { rows: res as Record<string, unknown>[], rowCount: (res as unknown[]).length };
  const qr = res as { rows?: Record<string, unknown>[]; rowCount?: number };
  return { rows: qr.rows ?? [], rowCount: qr.rowCount ?? 0 };
}

// ── Migration ─────────────────────────────────────────────────────────────────
export async function ensureUsersTable(): Promise<void> {
  await pgQuery(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      email         TEXT UNIQUE NOT NULL,
      name          TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'sdr',
      password_hash TEXT NOT NULL,
      active        BOOLEAN NOT NULL DEFAULT true,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Ajouter user_id aux tables existantes (migration safe avec IF NOT EXISTS)
  await pgQuery(`ALTER TABLE leads        ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id)`).catch(() => {});
  await pgQuery(`ALTER TABLE prospects    ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id)`).catch(() => {});
  await pgQuery(`ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id)`).catch(() => {});
  await pgQuery(`ALTER TABLE call_scripts ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id)`).catch(() => {});
}

// ── CRUD ──────────────────────────────────────────────────────────────────────
export async function dbGetUserByEmail(email: string): Promise<DbUser | null> {
  await ensureUsersTable();
  const { rows } = await pgQuery("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
  return (rows[0] as unknown as DbUser) ?? null;
}

export async function dbGetUserById(id: string): Promise<DbUser | null> {
  await ensureUsersTable();
  const { rows } = await pgQuery("SELECT * FROM users WHERE id = $1", [id]);
  return (rows[0] as unknown as DbUser) ?? null;
}

export async function dbGetAllUsers(): Promise<PublicUser[]> {
  await ensureUsersTable();
  const { rows } = await pgQuery(
    "SELECT id, email, name, role, active, created_at, updated_at FROM users ORDER BY created_at ASC"
  );
  return rows as PublicUser[];
}

export async function dbCreateUser(data: {
  email:         string;
  name:          string;
  role:          UserRole;
  password_hash: string;
}): Promise<PublicUser> {
  await ensureUsersTable();
  const { rows } = await pgQuery(
    `INSERT INTO users (email, name, role, password_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, name, role, active, created_at, updated_at`,
    [data.email.toLowerCase(), data.name, data.role, data.password_hash]
  );
  return rows[0] as PublicUser;
}

export async function dbUpdateUser(id: string, patch: {
  name?:          string;
  role?:          UserRole;
  active?:        boolean;
  password_hash?: string;
}): Promise<PublicUser | null> {
  await ensureUsersTable();
  const sets:   string[]   = ["updated_at = NOW()"];
  const params: unknown[]  = [];

  if (patch.name          !== undefined) { params.push(patch.name);          sets.push(`name = $${params.length}`); }
  if (patch.role          !== undefined) { params.push(patch.role);          sets.push(`role = $${params.length}`); }
  if (patch.active        !== undefined) { params.push(patch.active);        sets.push(`active = $${params.length}`); }
  if (patch.password_hash !== undefined) { params.push(patch.password_hash); sets.push(`password_hash = $${params.length}`); }

  params.push(id);
  const { rows } = await pgQuery(
    `UPDATE users SET ${sets.join(", ")} WHERE id = $${params.length}
     RETURNING id, email, name, role, active, created_at, updated_at`,
    params
  );
  return rows[0] as PublicUser | null ?? null;
}

export async function dbDeleteUser(id: string): Promise<boolean> {
  await ensureUsersTable();
  const { rowCount } = await pgQuery("DELETE FROM users WHERE id = $1", [id]);
  return rowCount > 0;
}

// ── Stats admin ───────────────────────────────────────────────────────────────
export async function dbGetUserStats(userId: string): Promise<{ leads: number; prospects: number }> {
  const [l, p] = await Promise.all([
    pgQuery("SELECT COUNT(*) as c FROM leads    WHERE user_id = $1", [userId]),
    pgQuery("SELECT COUNT(*) as c FROM prospects WHERE user_id = $1", [userId]),
  ]);
  return {
    leads:     Number((l.rows[0] as { c: string })?.c ?? 0),
    prospects: Number((p.rows[0] as { c: string })?.c ?? 0),
  };
}
