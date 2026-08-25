import { NextRequest, NextResponse } from "next/server";
import { dbGetLead, dbUpdateLead, dbDeleteLead } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  const lead = await dbGetLead(params.id);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // SDR ne peut accéder qu'à ses propres leads (via la DB on ne stocke pas owner dans data)
  // La protection principale est dans GET /api/leads (filtre userId)
  return NextResponse.json({ lead });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = requireAuth(req);
  if (error) return error;

  const patch = await req.json();
  const lead  = await dbUpdateLead(params.id, patch);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ lead });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = requireAuth(req);
  if (error) return error;

  const patch = await req.json();
  const lead  = await dbUpdateLead(params.id, patch);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ lead });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = requireAuth(req);
  if (error) return error;

  const ok = await dbDeleteLead(params.id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
