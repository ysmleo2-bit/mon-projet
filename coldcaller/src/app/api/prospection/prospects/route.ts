/**
 * GET  /api/prospection/prospects       — liste
 * POST /api/prospection/prospects/:id   — update statut / notes
 */

import { NextRequest, NextResponse } from "next/server";
import { dbGetProspects, dbUpdateProspect, dbDeleteProspect } from "@/lib/db-prospection";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const statut      = searchParams.get("statut")      as any ?? undefined;
  const secteur     = searchParams.get("secteur")     ?? undefined;
  const departement = searchParams.get("departement") ?? undefined;

  const prospects = await dbGetProspects({ statut, secteur, departement });
  return NextResponse.json({ prospects, total: prospects.length });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json() as { id: string; patch: Record<string, unknown> };
  const updated = await dbUpdateProspect(body.id, body.patch as any);
  return NextResponse.json({ ok: true, prospect: updated });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json() as { id: string };
  const ok = await dbDeleteProspect(id);
  return NextResponse.json({ ok });
}
