/**
 * POST /api/prospection/crm-sync
 * Synchronise un prospect B2B vers le CRM principal (table leads)
 */

import { NextRequest, NextResponse } from "next/server";
import type { Lead } from "@/lib/types";
import type { Prospect } from "@/lib/types-prospection";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { prospect } = await req.json() as { prospect: Prospect };
    if (!prospect?.siren) {
      return NextResponse.json({ error: "prospect.siren requis" }, { status: 400 });
    }

    const { dbAddLead, dbGetLeads } = await import("@/lib/db");

    // Vérifier si déjà présent dans le CRM (par siret ou id prospect)
    const existing = await dbGetLeads();
    const alreadyInCrm = existing.find(
      (l) => l.siret === prospect.siret || l.id === `crm-${prospect.siren}`
    );
    if (alreadyInCrm) {
      return NextResponse.json({ ok: true, leadId: alreadyInCrm.id, already: true });
    }

    const now = new Date().toISOString();

    // Construire les notes enrichies
    const notesParts: string[] = [];
    if (prospect.dirigeantPrincipal) {
      notesParts.push(`Dirigeant: ${prospect.dirigeantPrincipal}${prospect.fonctionDirigeant ? ` (${prospect.fonctionDirigeant})` : ""}`);
    }
    if (prospect.siren) notesParts.push(`SIREN: ${prospect.siren}`);
    if (prospect.siret) notesParts.push(`SIRET: ${prospect.siret}`);
    if (prospect.codeNaf) notesParts.push(`NAF: ${prospect.codeNaf}`);
    if (prospect.trancheEffectifs) notesParts.push(`Effectifs: ${prospect.trancheEffectifs}`);
    if (prospect.dateCreation) notesParts.push(`Créé en ${prospect.dateCreation.slice(0, 4)}`);
    if (prospect.notesCommercial) notesParts.push(prospect.notesCommercial);
    if (prospect.problematique) notesParts.push(`Problématique: ${prospect.problematique}`);

    const lead: Omit<Lead, "id"> & { id: string } = {
      id:           `crm-${prospect.siren}`,
      name:         prospect.nom,
      category:     prospect.libelleNaf || prospect.secteur || "B2B",
      phone:        prospect.telephonePro ?? "",
      address:      [prospect.adresse, prospect.codePostal, prospect.ville].filter(Boolean).join(", "),
      city:         prospect.ville ?? "",
      rating:       3,
      reviewCount:  0,
      website:      prospect.siteWeb,
      email:        prospect.emailDirigeant,
      status:       "new",
      notes:        notesParts.join(" | "),
      siret:        prospect.siret,
      source:       "sirene",
      detectedAt:   now,
      callCount:    0,
      callHistory:  [],
    };

    const created = await dbAddLead(lead as Partial<Lead>);
    return NextResponse.json({ ok: true, leadId: created.id, already: false });

  } catch (err) {
    console.error("[prospection/crm-sync]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
