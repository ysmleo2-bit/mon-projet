import { NextRequest, NextResponse } from "next/server";
import { dbGetLead, dbUpdateLead } from "@/lib/db";
import type { LeadStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

// POST /api/calls — enregistre un appel et met à jour le lead
export async function POST(req: NextRequest) {
  const { leadId, outcome, notes, duration } = await req.json();

  if (!leadId || !outcome) {
    return NextResponse.json({ error: "leadId and outcome are required" }, { status: 400 });
  }

  const existing = dbGetLead(leadId);
  if (!existing) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  // Mapper outcome → statut lead
  const STATUS_MAP: Record<string, LeadStatus> = {
    no_answer:      "contacted",
    interested:     "interested",
    not_interested: "lost",
    rdv:            "rdv",
    callback:       "contacted",
  };

  const patch = {
    status:       STATUS_MAP[outcome] ?? existing.status,
    callCount:    (existing.callCount ?? 0) + 1,
    lastContact:  new Date().toISOString(),
    notes:        notes ? `[${new Date().toLocaleTimeString("fr-FR")}] ${notes}` : existing.notes,
  };

  const lead = dbUpdateLead(leadId, patch);
  return NextResponse.json({ lead, duration });
}
