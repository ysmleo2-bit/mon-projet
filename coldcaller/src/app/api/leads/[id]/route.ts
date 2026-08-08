import { NextRequest, NextResponse } from "next/server";
import { dbGetLead, dbUpdateLead, dbDeleteLead } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/leads/:id
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const lead = dbGetLead(params.id);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ lead });
}

// PUT /api/leads/:id — mise à jour partielle
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const patch = await req.json();
  const lead  = dbUpdateLead(params.id, patch);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ lead });
}

// DELETE /api/leads/:id
export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const ok = dbDeleteLead(params.id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
