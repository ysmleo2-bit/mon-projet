/**
 * GET   /api/prospection/prospects  — liste filtrée
 * PATCH /api/prospection/prospects  — mise à jour + sync CRM automatique
 * DELETE /api/prospection/prospects — suppression
 *
 * Auto-sync CRM : dès qu'une action commerciale est enregistrée
 * (appel, email envoyé, statut intéressé/pas-intéressé…), le prospect
 * est automatiquement upsert dans le CRM sans action manuelle.
 */

import { NextRequest, NextResponse } from "next/server";
import { dbGetProspects, dbUpdateProspect, dbDeleteProspect } from "@/lib/db-prospection";
import type { StatutAppel, ProspectStatut } from "@/lib/types-prospection";

export const dynamic = "force-dynamic";

/** Statuts qui déclenchent une sync CRM automatique */
const CRM_TRIGGER_STATUTS: ProspectStatut[] = [
  "interesse", "pas_interesse", "repondu", "email_envoye", "a_relancer",
];
const CRM_TRIGGER_APPELS: StatutAppel[] = [
  "decroche", "pas_decroche", "echange_effectue", "message_envoye", "a_rappeler", "numero_invalide",
];

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
  const { id, patch } = body;

  // 1. Persister le patch en base
  const updated = await dbUpdateProspect(id, patch as any);

  // 2. Auto-sync CRM si action commerciale détectée
  const triggerCrm =
    (patch.statutAppel && CRM_TRIGGER_APPELS.includes(patch.statutAppel as StatutAppel)) ||
    (patch.statut      && CRM_TRIGGER_STATUTS.includes(patch.statut as ProspectStatut));

  if (triggerCrm && updated) {
    try {
      const { dbUpsertLeads } = await import("@/lib/db");
      const { prospectToLead } = await import("@/lib/crm-utils");
      const lead = prospectToLead(updated);
      await dbUpsertLeads([lead]);
      // Marquer comme étant dans le CRM
      if (!updated.danscrm) {
        await dbUpdateProspect(id, { danscrm: true, dateCrm: new Date().toISOString() });
      }
    } catch (crmErr) {
      // Non-bloquant : la mise à jour prospect est déjà faite
      console.warn("[prospects/patch] CRM sync skipped:", crmErr);
    }
  }

  return NextResponse.json({ ok: true, prospect: updated, crmSynced: !!triggerCrm });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json() as { id: string };
  const ok = await dbDeleteProspect(id);
  return NextResponse.json({ ok });
}
