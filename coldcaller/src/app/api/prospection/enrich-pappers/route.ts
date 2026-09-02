/**
 * POST /api/prospection/enrich-pappers
 * Enrichit un prospect existant avec les données complètes de Pappers.
 *
 * Données récupérées :
 *  - Chiffre d'affaires (+ historique)
 *  - Résultat net
 *  - Capital social
 *  - Effectifs réels
 *  - Forme juridique
 *  - Dirigeants complets avec fonctions
 *  - Site web, email, téléphone (si présents dans Pappers)
 *
 * Prérequis : PAPPERS_API_KEY dans les variables d'environnement Vercel.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";

export const dynamic     = "force-dynamic";
export const maxDuration = 30;

// ── Types Pappers ─────────────────────────────────────────────────────────────
interface PappersDirigeant {
  nom?:     string;
  prenom?:  string;
  qualite?: string;
}

interface PappersCleAnnuelle {
  annee?:           number;
  chiffre_affaires?: number;
  resultat?:         number;
  effectifs?:        number;
}

interface PappersEntreprise {
  siren:                string;
  nom_entreprise?:      string;
  forme_juridique?:     string;
  date_creation?:       string;
  capital?:             number | null;
  site_internet?:       string | null;
  email?:               string | null;
  telephone?:           string | null;
  chiffre_affaires?:    number | null;
  resultat?:            number | null;
  chiffres_cles?:       PappersCleAnnuelle[];
  dirigeants?:          PappersDirigeant[];
  siege?: {
    siret?:       string;
    adresse_ligne_1?: string;
    code_postal?: string;
    ville?:       string;
    departement?: string;
  };
  etablissements_secondaires?: unknown[];
  beneficiaires_effectifs?: unknown[];
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

// ── Appel API Pappers détail entreprise ───────────────────────────────────────
async function fetchPappersEntreprise(siren: string): Promise<PappersEntreprise | null> {
  const key = process.env.PAPPERS_API_KEY;
  if (!key) return null;

  const qs = new URLSearchParams({
    api_token:     key,
    siren,
    champs_extra: "chiffres_cles,dirigeants,siege,site_internet,email,telephone,capital,etablissements",
  });

  try {
    const res = await fetch(
      `https://api.pappers.fr/v2/entreprise?${qs.toString()}`,
      { signal: AbortSignal.timeout(20_000) }
    );
    if (!res.ok) {
      console.error("[pappers/entreprise] HTTP", res.status, await res.text());
      return null;
    }
    return await res.json() as PappersEntreprise;
  } catch (err) {
    console.error("[pappers/entreprise] error:", err);
    return null;
  }
}

// ── Formatage du CA pour affichage ───────────────────────────────────────────
function formatCa(ca: number): string {
  if (ca >= 1_000_000) return `${(ca / 1_000_000).toFixed(1)}M€`;
  if (ca >= 1_000)     return `${Math.round(ca / 1_000)}k€`;
  return `${ca}€`;
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

  // Nettoyer le SIREN (supprimer préfixe "prospect-" ou "-be-osm-…")
  const cleanSiren = siren.startsWith("prospect-")
    ? siren.replace("prospect-", "")
    : siren;

  // Siren numérique requis (9 chiffres)
  if (!/^\d{9}$/.test(cleanSiren)) {
    return NextResponse.json({
      ok: false,
      found: false,
      message: "SIREN invalide pour Pappers (entreprises françaises uniquement)",
    });
  }

  try {
    const data = await fetchPappersEntreprise(cleanSiren);
    if (!data) {
      return NextResponse.json({ ok: false, found: false, message: "Entreprise non trouvée dans Pappers" });
    }

    const now = new Date().toISOString();

    // Chiffres financiers — prendre l'année la plus récente
    const latestComptes = (data.chiffres_cles ?? [])
      .filter((c) => c.chiffre_affaires)
      .sort((a, b) => (b.annee ?? 0) - (a.annee ?? 0))[0];

    const ca          = data.chiffre_affaires ?? latestComptes?.chiffre_affaires;
    const resultat    = data.resultat ?? latestComptes?.resultat;
    const effectifReel = latestComptes?.effectifs;
    const caAnnee     = latestComptes?.annee?.toString();

    // Dirigeants
    const dirigeants = (data.dirigeants ?? [])
      .filter((d) => d.nom || d.prenom)
      .map((d) => ({
        nom:     d.nom ?? "",
        prenoms: d.prenom,
        qualite: d.qualite,
      }));

    const priorityQualites = ["gérant", "président", "directeur général", "associé gérant", "pdg"];
    const principal = dirigeants.find((d) =>
      priorityQualites.some((q) => d.qualite?.toLowerCase().includes(q))
    ) ?? dirigeants[0];
    const dirigeantPrincipal = principal
      ? [principal.prenoms, principal.nom].filter(Boolean).join(" ").trim()
      : undefined;

    // Patch pour la DB
    const patch: Record<string, unknown> = {
      pappersEnrichedAt: now,
    };

    const enrichDetails: string[] = [];

    if (ca && ca > 0) {
      patch.chiffreAffaires     = ca;
      patch.chiffreAffairesAnnee = caAnnee;
      enrichDetails.push(`CA ${formatCa(ca)}${caAnnee ? ` (${caAnnee})` : ""}`);
    }
    if (resultat !== undefined && resultat !== null) {
      patch.resultatNet = resultat;
      enrichDetails.push(`Résultat ${formatCa(resultat)}`);
    }
    if (data.capital && data.capital > 0) {
      patch.capitalSocial = data.capital;
      enrichDetails.push(`Capital ${formatCa(data.capital)}`);
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
    if (data.site_internet) {
      const siteWeb = data.site_internet
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, "");
      patch.siteWeb = siteWeb;
    }
    if (data.email) {
      patch.emailDirigeant = data.email;
      patch.emailSource    = "pappers";
      patch.emailVerifie   = true;
      enrichDetails.push(`Email : ${data.email}`);
    }
    if (data.telephone) {
      patch.telephonePro = normalizePhone(data.telephone);
    }

    // Ajouter une action dans l'historique
    if (enrichDetails.length > 0) {
      patch.actions = [{
        date:   now,
        type:   "enrichissement",
        detail: `Pappers : ${enrichDetails.join(" — ")}`,
      }];
    }

    // Persister en DB
    try {
      const { dbUpdateProspect } = await import("@/lib/db-prospection");
      await dbUpdateProspect(prospectId, patch as never);
    } catch (dbErr) {
      console.warn("[enrich-pappers] DB save skipped:", dbErr);
    }

    return NextResponse.json({
      ok:             true,
      found:          true,
      chiffreAffaires:      ca && ca > 0 ? ca : null,
      chiffreAffairesAnnee: caAnnee ?? null,
      resultatNet:          resultat ?? null,
      capitalSocial:        data.capital ?? null,
      effectifsReels:       effectifReel ?? null,
      formeJuridique:       data.forme_juridique ?? null,
      dirigeantPrincipal:   dirigeantPrincipal ?? null,
      dirigeants,
      siteWeb:              data.site_internet ?? null,
      email:                data.email ?? null,
      telephone:            data.telephone ? normalizePhone(data.telephone) : null,
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
