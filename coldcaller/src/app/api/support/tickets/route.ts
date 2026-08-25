/**
 * POST /api/support/tickets — créer un ticket support
 * GET  /api/support/tickets — lister les tickets (admin)
 * PATCH /api/support/tickets — mettre à jour le statut
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { dbCreateTicket, dbGetTickets, dbUpdateTicketStatus } from "@/lib/db-tickets";
import type { SupportTicket } from "@/lib/db-tickets";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Omit<SupportTicket, "id" | "createdAt" | "updatedAt" | "status">;
    if (!body.type || !body.description) {
      return NextResponse.json({ error: "type et description requis" }, { status: 400 });
    }
    // Add page from referer header if not provided
    if (!body.page) {
      body.page = req.headers.get("referer") ?? undefined;
    }
    body.userAgent = req.headers.get("user-agent") ?? undefined;
    const ticket = await dbCreateTicket(body);
    return NextResponse.json({ ok: true, ticket });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const tickets = await dbGetTickets();
    return NextResponse.json({ tickets });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, status } = await req.json() as { id: string; status: SupportTicket["status"] };
    await dbUpdateTicketStatus(id, status);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
