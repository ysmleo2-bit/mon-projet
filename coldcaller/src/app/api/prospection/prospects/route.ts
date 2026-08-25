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
import { requireAuth } from "@/lib/auth-server";
import type { StatutAppel, ProspectStatut } from "@/lib/types-prospection";

export const dynamic = "force-dynamic";

/** Statuts qui déclenchent une sync CRM automatique */
const CRM_TRIGGER_STATUTS: ProspectStatut[] = [
  "interesse", "pas_interesse", "repondu", "email_envoye", "a_relancer",
];
const CRM_TRIGGER_APPELS: StatutAppel[] = [
  "decroche", "pas_decroche", "mail_envoye", "echange_sans_suite", "r1_booke", "a_rappeler",
];

export async function GET(req: NextRequest) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const statut      = searchParams.get("statut")      as any ?? undefined;
  const secteur     = searchParams.get("secteur")     ?? undefined;
  const departement = searchParams.get("departement") ?? undefined;

  // Admin voit tout, SDR uniquement ses prospects
  const userId  = user!.role === "admin" ? undefined : user!.userId;
  const prospects = await dbGetProspects({ statut, secteur, departement, userId });
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

  let crmSynced = false;
  if (triggerCrm && updated) {
    try {
      const { dbUpsertLeads } = await import("@/lib/db");
      const { prospectToLead } = await import("@/lib/crm-utils");
      const lead = prospectToLead(updated);
      await dbUpsertLeads([lead]);
      crmSynced = true;
    } catch (crmErr) {
      console.error("[prospects/patch] CRM upsert failed:", crmErr);
    }

    // Marquer danscrm:true indépendamment de l'upsert
    // (évite de re-déclencher le sync à chaque action)
    const now = new Date().toISOString();
    try {
      await dbUpdateProspect(id, { danscrm: true, dateCrm: now });
    } catch { /* non-bloquant */ }
    updated.danscrm = true;
    updated.dateCrm = now;
  }

  return NextResponse.json({ ok: true, prospect: updated, crmSynced });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json() as { id: string };
  const ok = await dbDeleteProspect(id);
  return NextResponse.json({ ok });
}
