/**
 * POST /api/prospection/generate-email
 * Génère un email B2B personnalisé via Claude (claude-haiku-4-5)
 * ANTHROPIC_API_KEY requis dans les env vars Vercel
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import type { Prospect } from "@/lib/types-prospection";

export const dynamic     = "force-dynamic";
export const maxDuration = 30;

interface GeneratedEmail {
  problematique:  string;
  observation:    string;
  angleApproche:  string;
  objet:          string;
  corps:          string;
  scoreQualif:    number;
}

// ── Prompt de génération ──────────────────────────────────────────────────────
function buildPrompt(p: Partial<Prospect> & { nom: string }): string {
  const lines: string[] = [];
  lines.push("Tu es un expert en prospection B2B dans le secteur de l'IA et de l'automatisation commerciale.");
  lines.push("Tu dois générer un email de prospection ultra-personnalisé, naturel et percutant.");
  lines.push("");
  lines.push("## FICHE PROSPECT");
  lines.push(`Entreprise : ${p.nom}`);
  if (p.nomCommercial && p.nomCommercial !== p.nom) lines.push(`Nom commercial : ${p.nomCommercial}`);
  lines.push(`Secteur : ${p.libelleNaf ?? p.secteur ?? p.codeNaf}`);
  if (p.ville)              lines.push(`Ville : ${p.ville}`);
  if (p.trancheEffectifs)   lines.push(`Taille : ${p.trancheEffectifs} salariés`);
  if (p.siteWeb)            lines.push(`Site web : ${p.siteWeb}`);
  if (p.dirigeantPrincipal) lines.push(`Dirigeant : ${p.dirigeantPrincipal}`);
  if (p.fonctionDirigeant)  lines.push(`Fonction : ${p.fonctionDirigeant}`);
  if (p.dateCreation)       lines.push(`Créée en : ${p.dateCreation?.slice(0, 4)}`);
  lines.push("");
  lines.push("## MON OFFRE");
  lines.push("Je propose des solutions d'IA et d'automatisation pour développer l'acquisition commerciale des entreprises :");
  lines.push("- Agents IA de prospection automatique");
  lines.push("- Scraping + enrichissement de leads");
  lines.push("- Envoi automatisé d'emails personnalisés");
  lines.push("- CRM intelligent avec qualification automatique");
  lines.push("");
  lines.push("## INSTRUCTIONS");
  lines.push("1. Identifie la problématique d'acquisition probable de cette entreprise (1-2 phrases)");
  lines.push("2. Formule une observation spécifique et personnalisée sur l'entreprise");
  lines.push("3. Définis un angle d'approche pertinent et original");
  lines.push("4. Rédige un email de 150 mots max :");
  lines.push("   - Objet accrocheur, court (< 8 mots)");
  lines.push("   - Corps naturel, sans jargon, sans formules génériques");
  lines.push("   - L'entreprise doit sentir qu'elle a été vraiment étudiée");
  lines.push("   - Ne PAS commencer par 'Je me permets de...' ou 'Suite à votre...'");
  lines.push("   - Terminer par un CTA simple (15 min, pas de vente forcée)");
  lines.push("5. Attribue un score de qualification 0-100 (potentiel de conversion)");
  lines.push("");
  lines.push("Réponds UNIQUEMENT en JSON valide (pas de markdown) :");
  lines.push(`{
  "problematique": "...",
  "observation": "...",
  "angleApproche": "...",
  "objet": "...",
  "corps": "...",
  "scoreQualif": 75
}`);

  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY manquant. Ajoutez-la dans les variables d'environnement Vercel." },
      { status: 503 }
    );
  }

  const body = await req.json() as { prospectId: string; prospect: Partial<Prospect> & { nom: string } };
  const { prospectId, prospect } = body;

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client    = new Anthropic({ apiKey });

    const msg = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages:   [{ role: "user", content: buildPrompt(prospect) }],
    });

    const raw   = (msg.content[0] as { text: string }).text;
    // Extraire le JSON (Claude peut ajouter des backticks)
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("JSON introuvable dans la réponse");

    const gen = JSON.parse(match[0]) as GeneratedEmail;

    // Sauvegarder dans la DB
    const { dbUpdateProspect } = await import("@/lib/db-prospection");
    const now = new Date().toISOString();
    await dbUpdateProspect(prospectId, {
      problematique: gen.problematique,
      observation:   gen.observation,
      angleApproche: gen.angleApproche,
      emailObjet:    gen.objet,
      emailCorps:    gen.corps,
      scoreQualif:   gen.scoreQualif,
      statut:        "pret_a_envoyer",
      updatedAt:     now,
      actions: [{ date: now, type: "email_genere", detail: `Email généré (score: ${gen.scoreQualif}/100)` }],
    });

    return NextResponse.json({ ok: true, generated: gen });
  } catch (err) {
    console.error("[prospection/generate-email]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
