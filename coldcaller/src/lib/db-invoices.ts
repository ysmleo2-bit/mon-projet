/**
 * db-invoices.ts — gestion des factures SDR
 * Stockage Neon Postgres (table `invoices`)
 */

import { neon } from "@neondatabase/serverless";

export type InvoiceStatus = "deposee" | "en_verification" | "validee" | "refusee";

export interface Invoice {
  id:               string;
  user_id:          string;
  user_name:        string;
  month:            string;   // "2026-08"
  invoice_date:     string;   // ISO date
  invoice_number:   string;
  amount:           number;
  file_name:        string;
  file_type:        string;   // "application/pdf", "image/jpeg", etc.
  file_data:        string;   // base64
  status:           InvoiceStatus;
  rejection_reason: string;
  created_at:       string;
  updated_at:       string;
}

async function pgQuery(sql: string, params: unknown[] = []) {
  const db  = neon(process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? "");
  const res = await db.query(sql, params) as unknown;
  if (Array.isArray(res)) return { rows: res as Record<string, unknown>[], rowCount: (res as unknown[]).length };
  const qr = res as { rows?: Record<string, unknown>[]; rowCount?: number };
  return { rows: qr.rows ?? [], rowCount: qr.rowCount ?? 0 };
}

async function ensureTable() {
  await pgQuery(`
    CREATE TABLE IF NOT EXISTS invoices (
      id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id          TEXT NOT NULL,
      user_name        TEXT NOT NULL,
      month            TEXT NOT NULL,
      invoice_date     TEXT NOT NULL DEFAULT '',
      invoice_number   TEXT NOT NULL DEFAULT '',
      amount           NUMERIC(10,2) NOT NULL DEFAULT 0,
      file_name        TEXT NOT NULL DEFAULT '',
      file_type        TEXT NOT NULL DEFAULT '',
      file_data        TEXT NOT NULL DEFAULT '',
      status           TEXT NOT NULL DEFAULT 'deposee',
      rejection_reason TEXT NOT NULL DEFAULT '',
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

function rowToInvoice(r: Record<string, unknown>): Invoice {
  return {
    id:               String(r.id ?? ""),
    user_id:          String(r.user_id ?? ""),
    user_name:        String(r.user_name ?? ""),
    month:            String(r.month ?? ""),
    invoice_date:     String(r.invoice_date ?? ""),
    invoice_number:   String(r.invoice_number ?? ""),
    amount:           Number(r.amount ?? 0),
    file_name:        String(r.file_name ?? ""),
    file_type:        String(r.file_type ?? ""),
    file_data:        String(r.file_data ?? ""),
    status:           (r.status as InvoiceStatus) ?? "deposee",
    rejection_reason: String(r.rejection_reason ?? ""),
    created_at:       String(r.created_at ?? ""),
    updated_at:       String(r.updated_at ?? ""),
  };
}

export async function dbGetInvoices(filter?: { user_id?: string; month?: string; status?: string }): Promise<Invoice[]> {
  await ensureTable();
  let sql = "SELECT * FROM invoices";
  const params: unknown[] = [];
  const conds: string[] = [];
  if (filter?.user_id) { params.push(filter.user_id); conds.push(`user_id = $${params.length}`); }
  if (filter?.month)   { params.push(filter.month);   conds.push(`month = $${params.length}`); }
  if (filter?.status)  { params.push(filter.status);  conds.push(`status = $${params.length}`); }
  if (conds.length) sql += " WHERE " + conds.join(" AND ");
  sql += " ORDER BY created_at DESC";
  const res = await pgQuery(sql, params);
  return res.rows.map(rowToInvoice);
}

export async function dbGetInvoice(id: string): Promise<Invoice | null> {
  await ensureTable();
  const res = await pgQuery("SELECT * FROM invoices WHERE id = $1", [id]);
  if (!res.rows[0]) return null;
  return rowToInvoice(res.rows[0]);
}

export async function dbCreateInvoice(data: Omit<Invoice, "id" | "created_at" | "updated_at">): Promise<Invoice> {
  await ensureTable();
  const res = await pgQuery(
    `INSERT INTO invoices (user_id, user_name, month, invoice_date, invoice_number, amount, file_name, file_type, file_data, status, rejection_reason)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [data.user_id, data.user_name, data.month, data.invoice_date, data.invoice_number, data.amount,
     data.file_name, data.file_type, data.file_data, data.status, data.rejection_reason]
  );
  return rowToInvoice(res.rows[0]);
}

export async function dbUpdateInvoice(id: string, patch: Partial<Pick<Invoice, "status" | "rejection_reason" | "file_name" | "file_type" | "file_data" | "amount" | "invoice_date" | "invoice_number" | "month">>): Promise<Invoice | null> {
  await ensureTable();
  const sets: string[] = [];
  const params: unknown[] = [];
  const add = (col: string, val: unknown) => { params.push(val); sets.push(`${col} = $${params.length}`); };
  if (patch.status           !== undefined) add("status",           patch.status);
  if (patch.rejection_reason !== undefined) add("rejection_reason", patch.rejection_reason);
  if (patch.file_name        !== undefined) add("file_name",        patch.file_name);
  if (patch.file_type        !== undefined) add("file_type",        patch.file_type);
  if (patch.file_data        !== undefined) add("file_data",        patch.file_data);
  if (patch.amount           !== undefined) add("amount",           patch.amount);
  if (patch.invoice_date     !== undefined) add("invoice_date",     patch.invoice_date);
  if (patch.invoice_number   !== undefined) add("invoice_number",   patch.invoice_number);
  if (patch.month            !== undefined) add("month",            patch.month);
  if (!sets.length) return dbGetInvoice(id);
  sets.push(`updated_at = NOW()`);
  params.push(id);
  const res = await pgQuery(
    `UPDATE invoices SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING *`,
    params
  );
  if (!res.rows[0]) return null;
  return rowToInvoice(res.rows[0]);
}

export async function dbDeleteInvoice(id: string): Promise<boolean> {
  await ensureTable();
  const res = await pgQuery("DELETE FROM invoices WHERE id = $1", [id]);
  return (res.rowCount ?? 0) > 0;
}

/** Résumé par mois pour l'admin (qui a déposé, qui n'a pas déposé) */
export async function dbGetMonthSummary(month: string, allUserIds: string[]): Promise<Record<string, Invoice | null>> {
  await ensureTable();
  const res = await pgQuery(
    "SELECT * FROM invoices WHERE month = $1 ORDER BY created_at DESC",
    [month]
  );
  const byUser: Record<string, Invoice | null> = {};
  for (const uid of allUserIds) byUser[uid] = null;
  for (const row of res.rows) {
    const inv = rowToInvoice(row);
    if (!byUser[inv.user_id]) byUser[inv.user_id] = inv;
  }
  return byUser;
}
