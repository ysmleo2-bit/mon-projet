/**
 * POST /api/prospection/enrich-pappers
 * Enrichit un prospect avec les données complètes Pappers v2.
 *
 * Données récupérées via GET /v2/entreprise?siren=... :
 *  - finances[]         → CA, résultat, effectifs (par année)
 *  - representants[]    → dirigeants avec qualité
 *  - capital, forme_juridique, siege, telephone, email, sites_internet
 *
 * Prérequis : PAPPERS_API_KEY dans les variables d'environnement Vercel.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";

export const dynamic     = "force-dynamic";
export const maxDuration = 30;

// ── Types Pappers v2 /entreprise ──────────────────────────────────────────────
interface PappersRepresentant {
  nom?:     string;
  prenom?:  string;
  qualite?: string;
  type?:    string;   // "physique" | "morale"
}

interface PappersFinance {
  annee?:            number;
  chiffre_affaires?: number;
  resultat?:         number;
  effectifs?:        number;
}

interface PappersSiege {
  siret?:          string;
  adresse_ligne_1?: string;
  code_postal?:    string;
  ville?:          string;
  departement?:    string;
}

interface PappersSiteInternet {
  url?: string;
}

interface PappersEntrepriseDetail {
  siren:                string;
  nom_entreprise?:      string;
  denomination?:        string;
  forme_juridique?:     string;
  date_creation?:       string;
  capital?:             number | null;
  telephone?:           string | null;
  email?:               string | null;
  sites_internet?:      PappersSiteInternet[];
  finances?:            PappersFinance[];
  representants?:       PappersRepresentant[];
  siege?:               PappersSiege;
}

// ── Normalise un numéro de téléphone ─────────────────────────────────────────
function normalizePhone(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  let p = raw.replace(/[\s.\-]/g, "");
  if (p.startsWith("+33")) p = "0" + p.slice(3);
  if (p.startsWith("0033")) p = "0" + p.slice(4);
  if (p.length === 10 && p.startsWith("0")) {
    return p.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4 $5");
  }
  return raw.trim();
}

// ── Formatage montant ─────────────────────────────────────────────────────────
function formatMontant(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M€`;
  if (v >= 1_000)     return `${Math.round(v / 1_000)}k€`;
  return `${v}€`;
}

// ── Appel Pappers /v2/entreprise ──────────────────────────────────────────────
async function fetchPappersEntreprise(siren: string): Promise<PappersEntrepriseDetail | null> {
  const key = process.env.PAPPERS_API_KEY;
  if (!key) return null;

  const qs = new URLSearchParams({ api_token: key, siren });

  try {
    const res = await fetch(
      `https://api.pappers.fr/v2/entreprise?${qs.toString()}`,
      { signal: AbortSignal.timeout(20_000) }
    );
    if (!res.ok) {
      console.error("[pappers/entreprise] HTTP", res.status, await res.text());
      return null;
    }
    return await res.json() as PappersEntrepriseDetail;
  } catch (err) {
    console.error("[pappers/entreprise] error:", err);
    return null;
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { error: authError } = requireAuth(req);
  if (authError) return authError;

  if (!process.env.PAPPERS_API_KEY) {
    return NextResponse.json({
      error:   "PAPPERS_API_KEY non configurée",
      message: "Ajoutez PAPPERS_API_KEY dans les variables d'environnement Vercel.",
    }, { status: 503 });
  }

  const body = await req.json() as { prospectId: string; siren: string };
  const { prospectId, siren } = body;

  if (!prospectId || !siren) {
    return NextResponse.json({ error: "prospectId et siren requis" }, { status: 400 });
  }

  // Nettoyer le SIREN (supprimer éventuel préfixe "prospect-")
  const cleanSiren = siren.replace(/^prospect-/, "");

  // Siren numérique requis (9 chiffres)
  if (!/^\d{9}$/.test(cleanSiren)) {
    return NextResponse.json({
      ok: false, found: false,
      message: "SIREN invalide — Pappers ne couvre que les entreprises françaises (9 chiffres)",
    });
  }

  try {
    const data = await fetchPappersEntreprise(cleanSiren);
    if (!data) {
      return NextResponse.json({ ok: false, found: false, message: "Entreprise non trouvée dans Pappers" });
    }

    const now = new Date().toISOString();

    // ── Finances : prendre l'année la plus récente ────────────────────────────
    const latestFinance = (data.finances ?? [])
      .filter((f) => f.chiffre_affaires !== undefined && f.chiffre_affaires !== null)
      .sort((a, b) => (b.annee ?? 0) - (a.annee ?? 0))[0];

    const ca          = latestFinance?.chiffre_affaires;
    const resultat    = latestFinance?.resultat;
    const effectifReel = latestFinance?.effectifs;
    const caAnnee     = latestFinance?.annee?.toString();

    // ── Dirigeants (representants physiques uniquement) ───────────────────────
    const representants = (data.representants ?? []).filter((r) => r.type !== "morale" && (r.nom || r.prenom));
    const dirigeants    = representants.map((r) => ({
      nom:     r.nom ?? "",
      prenoms: r.prenom,
      qualite: r.qualite,
    }));

    const priorityQualites = ["gérant", "président", "directeur général", "associé gérant", "pdg"];
    const principal = dirigeants.find((d) =>
      priorityQualites.some((q) => d.qualite?.toLowerCase().includes(q))
    ) ?? dirigeants[0];
    const dirigeantPrincipal = principal
      ? [principal.prenoms, principal.nom].filter(Boolean).join(" ").trim()
      : undefined;

    // ── Site internet ─────────────────────────────────────────────────────────
    const siteRaw = data.sites_internet?.[0]?.url ?? null;
    const siteWeb = siteRaw
      ? siteRaw.replace(/^https?:\/\//, "").replace(/\/$/, "")
      : null;

    // ── Patch DB ──────────────────────────────────────────────────────────────
    const patch: Record<string, unknown> = { pappersEnrichedAt: now };
    const enrichDetails: string[] = [];

    if (ca && ca > 0) {
      patch.chiffreAffaires      = ca;
      patch.chiffreAffairesAnnee = caAnnee;
      enrichDetails.push(`CA ${formatMontant(ca)}${caAnnee ? ` (${caAnnee})` : ""}`);
    }
    if (resultat !== undefined && resultat !== null) {
      patch.resultatNet = resultat;
      enrichDetails.push(`Résultat ${resultat >= 0 ? "+" : ""}${formatMontant(Math.abs(resultat))}`);
    }
    if (data.capital && data.capital > 0) {
      patch.capitalSocial = data.capital;
      enrichDetails.push(`Capital ${formatMontant(data.capital)}`);
    }
    if (effectifReel) {
      patch.effectifsReels = effectifReel;
      enrichDetails.push(`${effectifReel} salariés`);
    }
    if (data.forme_juridique) {
      patch.formeJuridique = data.forme_juridique;
    }
    if (dirigeants.length > 0) {
      patch.dirigeants = dirigeants;
      if (dirigeantPrincipal) {
        patch.dirigeantPrincipal = dirigeantPrincipal;
        patch.fonctionDirigeant  = principal?.qualite;
      }
    }
    if (siteWeb) patch.siteWeb = siteWeb;
    if (data.email) {
      patch.emailDirigeant = data.email;
      patch.emailSource    = "pappers";
      patch.emailVerifie   = true;
      enrichDetails.push(`Email : ${data.email}`);
    }
    if (data.telephone) {
      patch.telephonePro = normalizePhone(data.telephone);
    }

    if (enrichDetails.length > 0) {
      patch.actions = [{ date: now, type: "enrichissement", detail: `Pappers : ${enrichDetails.join(" — ")}` }];
    }

    try {
      const { dbUpdateProspect } = await import("@/lib/db-prospection");
      await dbUpdateProspect(prospectId, patch as never);
    } catch (dbErr) {
      console.warn("[enrich-pappers] DB save skipped:", dbErr);
    }

    return NextResponse.json({
      ok:                   true,
      found:                true,
      chiffreAffaires:      ca ?? null,
      chiffreAffairesAnnee: caAnnee ?? null,
      resultatNet:          resultat ?? null,
      capitalSocial:        data.capital ?? null,
      effectifsReels:       effectifReel ?? null,
      formeJuridique:       data.forme_juridique ?? null,
      dirigeantPrincipal:   dirigeantPrincipal ?? null,
      dirigeants,
      siteWeb,
      email:                data.email ?? null,
      telephone:            normalizePhone(data.telephone) ?? null,
      enrichDetails,
      message: enrichDetails.length > 0
        ? enrichDetails.join(" — ")
        : "Aucune donnée financière disponible dans Pappers",
    });
  } catch (err) {
    console.error("[enrich-pappers]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
