/**
 * POST /api/prospection/resync-crm
 * Re-sync forcée de tous les prospects actifs vers la table leads.
 * À appeler une seule fois après un fix de mapping pour corriger les leads mal classés.
 * Protégé par auth.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { error } = requireAuth(req);
  if (error) return error;

  try {
    const { dbGetProspects } = await import("@/lib/db-prospection");
    const { dbUpsertLeads }  = await import("@/lib/db");
    const { prospectToLead } = await import("@/lib/crm-utils");

    // Récupérer tous les prospects qui ont une action commerciale
    const all = await dbGetProspects();
    const active = all.filter((p) =>
      p.statutAppel && p.statutAppel !== "non_appele"
    );

    let synced = 0;
    let errors = 0;

    // Batch par 20 pour éviter les timeouts
    const BATCH = 20;
    for (let i = 0; i < active.length; i += BATCH) {
      const batch = active.slice(i, i + BATCH);
      try {
        const leads = batch.map(prospectToLead);
        await dbUpsertLeads(leads);
        synced += batch.length;
      } catch (err) {
        console.error("[resync-crm] batch error:", err);
        errors += batch.length;
      }
    }

    return NextResponse.json({
      ok:     true,
      total:  active.length,
      synced,
      errors,
      message: `${synced} prospects re-synchronisés vers le CRM`,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
