import { NextRequest, NextResponse } from "next/server";
import { dbGetLead, dbUpdateLead, dbDeleteLead } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const lead = await dbGetLead(params.id);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ lead });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const patch = await req.json();
  const lead  = await dbUpdateLead(params.id, patch);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ lead });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const ok = await dbDeleteLead(params.id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
