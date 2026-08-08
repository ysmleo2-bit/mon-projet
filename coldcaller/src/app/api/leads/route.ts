import { NextRequest, NextResponse } from "next/server";
import { dbGetLeads, dbUpsertLeads } from "@/lib/db";
import type { Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/leads
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status   = searchParams.get("status");
  const category = searchParams.get("category");

  let leads = dbGetLeads();
  if (status)   leads = leads.filter((l) => l.status   === status);
  if (category) leads = leads.filter((l) => l.category === category);

  return NextResponse.json({ leads, total: leads.length });
}

// POST /api/leads — batch upsert (import depuis le scraper)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const incoming: Lead[] = Array.isArray(body) ? body : [body];
  const leads = dbUpsertLeads(incoming);
  return NextResponse.json({ leads, total: leads.length }, { status: 201 });
}
