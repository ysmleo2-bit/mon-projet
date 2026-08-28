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
import { dbGetProspects, dbGetProspect, dbUpdateProspect, dbDeleteProspect } from "@/lib/db-prospection";
import { requireAuth } from "@/lib/auth-server";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const statut      = searchParams.get("statut")      as any ?? undefined;
  const secteur     = searchParams.get("secteur")     ?? undefined;
  const departement = searchParams.get("departement") ?? undefined;
  // ?mine=true → filtrer uniquement ses propres prospects
  const mine         = searchParams.get("mine") === "true";
  const assignedToId = mine ? user!.userId : undefined;

  const prospects = await dbGetProspects({ statut, secteur, departement, assignedToId });
  return NextResponse.json({ prospects, total: prospects.length });
}

export async function PATCH(req: NextRequest) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  const body = await req.json() as { id: string; patch: Record<string, unknown> };
  const { id, patch } = body;

  // Auto-attribution SDR : si le prospect n'a pas encore de SDR assigné,
  // l'attribuer automatiquement au SDR qui prend l'action (appel, statut, etc.)
  if (patch.assignedToId === undefined) {
    const existing = await dbGetProspect(id);
    if (existing && !existing.assignedToId) {
      patch.assignedToId = user!.userId;
      patch.assignedTo   = user!.name;
    }
  }

  // 1. Persister le patch en base
  const updated = await dbUpdateProspect(id, patch as any);

  // 2. Auto-sync CRM dès qu'un appel est enregistré ou qu'un statut pipeline change
  // — statutAppel positionné (même à non_appele pour reset) → sync
  // — statut pipeline changé → sync
  // — notes commerciales ajoutées → sync
  const triggerCrm =
    patch.statutAppel !== undefined ||
    patch.statut      !== undefined ||
    (patch.notesCommercial !== undefined && String(patch.notesCommercial).trim().length > 0);

  let crmSynced = false;
  let crmError: string | undefined;

  if (triggerCrm && updated) {
    try {
      const { dbUpsertLeads } = await import("@/lib/db");
      const { prospectToLead } = await import("@/lib/crm-utils");
      const lead = prospectToLead(updated);
      await dbUpsertLeads([lead]);
      crmSynced = true;
    } catch (crmErr) {
      console.error("[prospects/patch] CRM upsert failed:", crmErr);
      crmError = String(crmErr);
    }

    // Marquer danscrm:true UNIQUEMENT si la sync a vraiment réussi
    // (évitait un faux positif : badge vert "Dans le CRM" alors que le lead n'était pas en base)
    if (crmSynced) {
      const now = new Date().toISOString();
      try {
        await dbUpdateProspect(id, { danscrm: true, dateCrm: now });
      } catch { /* non-bloquant */ }
      updated.danscrm = true;
      updated.dateCrm = now;
    }
  }

  return NextResponse.json({ ok: true, prospect: updated, crmSynced, ...(crmError ? { crmError } : {}) });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json() as { id: string };
  const ok = await dbDeleteProspect(id);
  return NextResponse.json({ ok });
}
