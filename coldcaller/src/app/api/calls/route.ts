import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { dbGetLead, dbUpdateLead } from "@/lib/db";
import type { LeadStatus, CallOutcome, CallRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

// POST /api/calls — enregistre un appel et met à jour le lead
export async function POST(req: NextRequest) {
  const { leadId, outcome, notes, duration } = await req.json() as {
    leadId: string; outcome: CallOutcome; notes?: string; duration?: number;
  };

  if (!leadId || !outcome) {
    return NextResponse.json({ error: "leadId and outcome are required" }, { status: 400 });
  }

  const existing = await dbGetLead(leadId);
  if (!existing) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  // Garde-fou RGPD : un lead qui s'est opposé ne doit plus jamais être appelé.
  if (existing.doNotCall) {
    return NextResponse.json(
      { error: "Ce numéro est sur liste \"ne plus appeler\". Appel bloqué." },
      { status: 403 }
    );
  }

  const STATUS_MAP: Record<CallOutcome, LeadStatus> = {
    no_answer:      "contacted",
    interested:     "interested",
    not_interested: "lost",
    rdv:            "rdv",
    callback:       "contacted",
  };

  const record: CallRecord = {
    at:       new Date().toISOString(),
    duration: duration ?? 0,
    outcome,
    notes:    notes?.trim() || undefined,
  };

  const patch = {
    status:      STATUS_MAP[outcome] ?? existing.status,
    callCount:   (existing.callCount ?? 0) + 1,
    lastContact: new Date().toISOString(),
    notes:       notes?.trim()
      ? `[${new Date().toLocaleTimeString("fr-FR")}] ${notes.trim()}`
      : existing.notes,
    callHistory: [...(existing.callHistory ?? []), record],
  };

  const lead = await dbUpdateLead(leadId, patch);
  return NextResponse.json({ lead, duration });
}
