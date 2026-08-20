/**
 * db-tickets.ts — Tickets de support / bug reports
 */

export interface SupportTicket {
  id:          string;
  type:        "bug" | "technique" | "question" | "suggestion" | "autre";
  description: string;
  page?:       string;
  screenshotUrl?: string;
  status:      "nouveau" | "en_cours" | "resolu";
  createdAt:   string;
  updatedAt:   string;
  userEmail?:  string;
  userAgent?:  string;
}

const USE_PG = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL);
const JSON_PATH = "data/support-tickets.json";

async function ensureTable() {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.POSTGRES_URL || process.env.DATABASE_URL!);
  await sql`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id          TEXT PRIMARY KEY,
      data        JSONB NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  return sql;
}

function readJson(): SupportTicket[] {
  try {
    const { readFileSync } = require("fs");
    return JSON.parse(readFileSync(JSON_PATH, "utf-8")) as SupportTicket[];
  } catch { return []; }
}

function writeJson(tickets: SupportTicket[]) {
  const { writeFileSync, mkdirSync } = require("fs");
  mkdirSync("data", { recursive: true });
  writeFileSync(JSON_PATH, JSON.stringify(tickets, null, 2));
}

function newId() {
  return `tkt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function dbCreateTicket(data: Omit<SupportTicket, "id" | "createdAt" | "updatedAt" | "status">): Promise<SupportTicket> {
  const ticket: SupportTicket = {
    ...data,
    id:        newId(),
    status:    "nouveau",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (USE_PG) {
    try {
      const sql = await ensureTable();
      await sql`
        INSERT INTO support_tickets (id, data)
        VALUES (${ticket.id}, ${JSON.stringify(ticket) as any})
      `;
    } catch (e) {
      console.warn("[db-tickets] save failed:", e);
    }
  } else {
    const tickets = readJson();
    tickets.unshift(ticket);
    writeJson(tickets);
  }
  return ticket;
}

export async function dbGetTickets(): Promise<SupportTicket[]> {
  if (USE_PG) {
    try {
      const sql = await ensureTable();
      const rows = await sql`SELECT data FROM support_tickets ORDER BY created_at DESC`;
      return rows.map((r: any) => r.data as SupportTicket);
    } catch { return []; }
  }
  return readJson();
}

export async function dbUpdateTicketStatus(id: string, status: SupportTicket["status"]): Promise<void> {
  if (USE_PG) {
    try {
      const sql = await ensureTable();
      // Get existing, update status field in JSONB
      const rows = await sql`SELECT data FROM support_tickets WHERE id = ${id}`;
      if (rows.length > 0) {
        const ticket = { ...(rows[0].data as SupportTicket), status, updatedAt: new Date().toISOString() };
        await sql`UPDATE support_tickets SET data = ${JSON.stringify(ticket) as any}, updated_at = NOW() WHERE id = ${id}`;
      }
    } catch (e) {
      console.warn("[db-tickets] update failed:", e);
    }
  } else {
    const tickets = readJson();
    const idx = tickets.findIndex((t) => t.id === id);
    if (idx !== -1) {
      tickets[idx] = { ...tickets[idx], status, updatedAt: new Date().toISOString() };
      writeJson(tickets);
    }
  }
}
