import { NextRequest, NextResponse } from "next/server";
import { dbGetLeads, dbUpsertLeads } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import type { Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/leads?status=new&category=Plombier
export async function GET(req: NextRequest) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const status     = searchParams.get("status")     ?? undefined;
  const category   = searchParams.get("category")   ?? undefined;
  const callStatus = searchParams.get("callStatus") ?? undefined;

  // Admin voit tout, SDR uniquement ses leads
  const userId = user!.role === "admin" ? undefined : user!.userId;
  const leads  = await dbGetLeads({ status, category, callStatus, userId });
  return NextResponse.json({ leads, total: leads.length });
}

// POST /api/leads — batch upsert
export async function POST(req: NextRequest) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  const body  = await req.json() as Lead[];
  const leads = Array.isArray(body) ? body : [body];

  // Associer chaque lead à l'utilisateur courant
  const userId = user!.userId;
  await dbUpsertLeads(leads, userId);
  return NextResponse.json({ ok: true, count: leads.length });
}
