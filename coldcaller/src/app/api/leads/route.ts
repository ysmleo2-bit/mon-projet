import { NextRequest, NextResponse } from "next/server";
import { dbGetLeads, dbUpsertLeads } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import type { Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/leads?status=new&category=Plombier&mine=true
export async function GET(req: NextRequest) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const status     = searchParams.get("status")     ?? undefined;
  const category   = searchParams.get("category")   ?? undefined;
  const callStatus = searchParams.get("callStatus") ?? undefined;
  // ?mine=true → filtrer uniquement ses propres leads
  const mine       = searchParams.get("mine") === "true";
  const assignedToId = mine ? user!.userId : undefined;

  const leads = await dbGetLeads({ status, category, callStatus, assignedToId });
  return NextResponse.json({ leads, total: leads.length });
}

// POST /api/leads — batch upsert (auto-assigne au créateur si pas déjà assigné)
export async function POST(req: NextRequest) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  const body  = await req.json() as Lead[];
  const leads = Array.isArray(body) ? body : [body];

  // Auto-assigner les leads sans assignataire au créateur courant
  const enriched = leads.map((l) => ({
    ...l,
    assignedToId: l.assignedToId ?? user!.userId,
    assignedTo:   l.assignedTo   ?? user!.name,
  }));

  await dbUpsertLeads(enriched);
  return NextResponse.json({ ok: true, count: enriched.length });
}
