/**
 * POST /api/prospection/crm-sync
 * Synchronise (upsert) un prospect B2B vers le CRM principal (table leads).
 * Appelé à la création ET à chaque action commerciale (appel, email, statut).
 */

import { NextRequest, NextResponse } from "next/server";
import type { Lead, CallRecord, CallOutcome } from "@/lib/types";
import type { Prospect, StatutAppel, ProspectStatut } from "@/lib/types-prospection";

export const dynamic = "force-dynamic";

// ── Mapping statuts prospection → CRM ────────────────────────────────────────

function toLeadStatus(statut: ProspectStatut, statutAppel?: StatutAppel): Lead["status"] {
  if (statut === "pas_interesse") return "lost";
  if (statut === "interesse")     return "interested";
  if (statut === "repondu")       return "interested";
  if (statutAppel && statutAppel !== "non_appele") return "contacted";
  return "new";
}

function toCallOutcome(sa: StatutAppel): CallOutcome {
  switch (sa) {
    case "echange_effectue":  return "interested";
    case "decroche":          return "interested";
    case "pas_decroche":      return "no_answer";
    case "numero_invalide":   return "not_interested";
    case "message_envoye":    return "callback";
    case "a_rappeler":        return "callback";
    default:                  return "no_answer";
  }
}

/** Construit / met à jour le Lead CRM depuis un Prospect enrichi. */
export function prospectToLead(prospect: Prospect): Lead {
  const notesParts: string[] = [];
  if (prospect.dirigeantPrincipal)
    notesParts.push(`Dirigeant: ${prospect.dirigeantPrincipal}${prospect.fonctionDirigeant ? ` (${prospect.fonctionDirigeant})` : ""}`);
  if (prospect.siren)           notesParts.push(`SIREN: ${prospect.siren}`);
  if (prospect.siret)           notesParts.push(`SIRET: ${prospect.siret}`);
  if (prospect.codeNaf)         notesParts.push(`NAF: ${prospect.codeNaf}`);
  if (prospect.trancheEffectifs) notesParts.push(`Effectifs: ${prospect.trancheEffectifs}`);
  if (prospect.dateCreation)    notesParts.push(`Créé en ${prospect.dateCreation.slice(0, 4)}`);
  if (prospect.notesCommercial) notesParts.push(prospect.notesCommercial);
  if (prospect.problematique)   notesParts.push(`Problématique: ${prospect.problematique}`);
  if (prospect.linkedinDirigeant) notesParts.push(`LinkedIn: ${prospect.linkedinDirigeant}`);

  // Historique d'appels reconstruit depuis les actions
  const callHistory: CallRecord[] = prospect.actions
    .filter((a) => a.type === "appel" && prospect.statutAppel && prospect.statutAppel !== "non_appele")
    .map((a) => ({
      at:       a.date,
      duration: 0,
      outcome:  toCallOutcome(prospect.statutAppel!),
      notes:    a.detail,
    }));

  // Si statutAppel renseigné mais pas d'action "appel" dans l'historique → ajouter
  if (
    prospect.statutAppel &&
    prospect.statutAppel !== "non_appele" &&
    callHistory.length === 0 &&
    prospect.dateAppel
  ) {
    callHistory.push({
      at:       prospect.dateAppel,
      duration: 0,
      outcome:  toCallOutcome(prospect.statutAppel),
      notes:    prospect.statutAppel,
    });
  }

  return {
    id:          `crm-${prospect.siren}`,
    name:        prospect.nom,
    category:    prospect.libelleNaf || prospect.secteur || "B2B",
    phone:       prospect.telephonePro ?? "",
    address:     [prospect.adresse, prospect.codePostal, prospect.ville].filter(Boolean).join(", "),
    city:        prospect.ville ?? "",
    rating:      3,
    reviewCount: 0,
    website:     prospect.siteWeb,
    email:       prospect.emailDirigeant,
    status:      toLeadStatus(prospect.statut, prospect.statutAppel),
    notes:       notesParts.join(" | "),
    siret:       prospect.siret,
    source:      "sirene",
    detectedAt:  prospect.createdAt,
    callCount:   callHistory.length,
    callHistory,
    lastContact: prospect.dateAppel,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { prospect } = await req.json() as { prospect: Prospect };
    if (!prospect?.siren) {
      return NextResponse.json({ error: "prospect.siren requis" }, { status: 400 });
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
