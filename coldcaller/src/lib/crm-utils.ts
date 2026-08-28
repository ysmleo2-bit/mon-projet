/**
 * Utilitaires partagés pour la conversion Prospect → Lead (sync CRM)
 */

import type { Lead, CallRecord, CallOutcome } from "@/lib/types";
import type { Prospect, StatutAppel, ProspectStatut } from "@/lib/types-prospection";

// ── Mapping statuts prospection → CRM ────────────────────────────────────────

export function toLeadStatus(statut: ProspectStatut, statutAppel?: StatutAppel): Lead["status"] {
  // statutAppel a la priorité absolue — un R1 booké reste "rdv"
  // même si le statut pipeline vaut "interesse" ou "repondu"
  if (statutAppel === "r1_booke")                  return "rdv";
  if (statut === "pas_interesse")                  return "lost";
  if (statut === "interesse")                      return "interested";
  if (statut === "repondu")                        return "interested";
  if (statutAppel && statutAppel !== "non_appele") return "contacted";
  return "new";
}

export function toCallOutcome(sa: StatutAppel): CallOutcome {
  switch (sa) {
    case "r1_booke":           return "rdv";
    case "decroche":           return "interested";
    case "echange_sans_suite": return "callback";
    case "pas_decroche":       return "no_answer";
    case "mail_envoye":        return "callback";
    case "a_rappeler":         return "callback";
    default:                   return "no_answer";
  }
}

/** Construit / met à jour le Lead CRM depuis un Prospect enrichi. */
export function prospectToLead(prospect: Prospect): Lead {
  const notesParts: string[] = [];
  if (prospect.dirigeantPrincipal)
    notesParts.push(`Dirigeant: ${prospect.dirigeantPrincipal}${prospect.fonctionDirigeant ? ` (${prospect.fonctionDirigeant})` : ""}`);
  if (prospect.siren)             notesParts.push(`SIREN: ${prospect.siren}`);
  if (prospect.siret)             notesParts.push(`SIRET: ${prospect.siret}`);
  if (prospect.codeNaf)           notesParts.push(`NAF: ${prospect.codeNaf}`);
  if (prospect.trancheEffectifs)  notesParts.push(`Effectifs: ${prospect.trancheEffectifs}`);
  if (prospect.dateCreation)      notesParts.push(`Créé en ${prospect.dateCreation.slice(0, 4)}`);
  if (prospect.notesCommercial)   notesParts.push(prospect.notesCommercial);
  if (prospect.problematique)     notesParts.push(`Problématique: ${prospect.problematique}`);
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

  // Si statutAppel renseigné mais pas d'entrée dans callHistory → en ajouter une
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
    // ID stable basé sur prospect.id (jamais modifié), évite les doublons
    // si le SIREN est enrichi après la première sync.
    id:          `crm-${prospect.id}`,
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
    lastContact: prospect.dateAppel ?? prospect.updatedAt,
    callStatus:  prospect.statutAppel ?? "non_appele",
    prospectId:  prospect.id,
    crmSyncedAt: new Date().toISOString(),
    // ── Attribution SDR : recopier du prospect vers le lead CRM ──────────────
    assignedToId: prospect.assignedToId,
    assignedTo:   prospect.assignedTo,
  };
}
