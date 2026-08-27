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
  const { user, error } = requireAuth(req);
  if (error) return error;

  const patch = await req.json() as Record<string, unknown>;

  // Auto-attribution : si le lead n'a pas encore d'assignataire,
  // l'attribuer automatiquement au SDR qui prend une action dessus
  // (changement de statut, callStatus, notes…).
  // Si la mise à jour est une attribution explicite (assignedToId dans le patch), on respecte ça.
  const existing = await dbGetLead(params.id);
  if (existing && !existing.assignedToId && patch.assignedToId === undefined) {
    patch.assignedToId = user!.userId;
    patch.assignedTo   = user!.name;
  }

  const lead = await dbUpdateLead(params.id, patch as Partial<import("@/lib/types").Lead>);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ lead });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  const patch = await req.json() as Record<string, unknown>;

  // Même logique d'auto-attribution
  const existing = await dbGetLead(params.id);
  if (existing && !existing.assignedToId && patch.assignedToId === undefined) {
    patch.assignedToId = user!.userId;
    patch.assignedTo   = user!.name;
  }

  const lead = await dbUpdateLead(params.id, patch as Partial<import("@/lib/types").Lead>);
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
