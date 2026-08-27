/**
 * POST /api/prospection/crm-sync
 * Synchronise (upsert) un prospect B2B vers le CRM principal (table leads).
 * Appelé à la création ET à chaque action commerciale (appel, email, statut).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import type { Prospect } from "@/lib/types-prospection";
import { prospectToLead } from "@/lib/crm-utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { user } = requireAuth(req);   // peut être null si pas de session (cas rare)
    const { prospect } = await req.json() as { prospect: Prospect };
    if (!prospect?.siren) {
      return NextResponse.json({ error: "prospect.siren requis" }, { status: 400 });
    }

    // Si le prospect n'a pas de SDR attribué, l'attribuer au SDR qui déclenche la sync
    if (!prospect.assignedToId && user) {
      prospect.assignedToId = user.userId;
      prospect.assignedTo   = user.name;
    }

    const { dbUpsertLeads } = await import("@/lib/db");
    const lead = prospectToLead(prospect);
    await dbUpsertLeads([lead]);

    return NextResponse.json({ ok: true, leadId: lead.id });
  } catch (err) {
    console.error("[prospection/crm-sync]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
