import { NextRequest, NextResponse } from "next/server";
import { dbGetLeads, dbUpsertLeads } from "@/lib/db";
import type { Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/leads?status=new&category=Plombier
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status   = searchParams.get("status")   ?? undefined;
  const category = searchParams.get("category") ?? undefined;

  const leads = await dbGetLeads({ status, category });
  return NextResponse.json({ leads, total: leads.length });
}

// POST /api/leads — batch upsert
export async function POST(req: NextRequest) {
  const body = await req.json() as Lead[];
  const leads = Array.isArray(body) ? body : [body];
  await dbUpsertLeads(leads);
  return NextResponse.json({ ok: true, count: leads.length });
}
