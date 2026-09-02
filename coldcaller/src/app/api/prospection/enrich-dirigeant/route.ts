/**
 * POST /api/prospection/enrich-dirigeant
 * Enrichit le mobile et l'email du dirigeant via FullEnrich.
 *
 * FullEnrich agrège 15+ sources B2B (Kaspr, Lusha, Dropcontact…) et retourne
 * le numéro mobile vérifié + email professionnel du dirigeant.
 *
 * Prérequis : FULLENRICH_API_KEY dans les variables d'environnement Vercel.
 * Coût : ~1 crédit par contact enrichi (uniquement si données trouvées).
 *
 * API FullEnrich : https://api.fullenrich.com/v1/enrich
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";

export const dynamic     = "force-dynamic";
export const maxDuration = 30;

// ── Types FullEnrich ──────────────────────────────────────────────────────────
interface FullEnrichPhone {
  number:     string;
  type?:      string;  // "mobile" | "direct" | "work"
  verified?:  boolean;
}

interface FullEnrichEmail {
  email:      string;
  type?:      string;  // "work" | "personal"
  confidence?: number;
}

interface FullEnrichContact {
  first_name?:    string;
  last_name?:     string;
  full_name?:     string;
  phones?:        FullEnrichPhone[];
  emails?:        FullEnrichEmail[];
  linkedin_url?:  string;
}

interface FullEnrichResult {
  contact?:      FullEnrichContact;
  credits_used?: number;
  error?:        string;
}

interface FullEnrichResponse {
  requests: FullEnrichResult[];
}

// ── Normalise un numéro FullEnrich (souvent au format international) ─────────
function normalizePhone(raw: string): string {
  let p = raw.replace(/[\s.–\-]/g, "");
  // Convertir +33 → 0
  if (p.startsWith("+33")) p = "0" + p.slice(3);
  if (p.startsWith("0033")) p = "0" + p.slice(4);
  if (p.length === 10 && p.startsWith("0")) {
    return p.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4 $5");
  }
  return raw.trim();
}

// ── Appel API FullEnrich ──────────────────────────────────────────────────────
async function callFullEnrich(params: {
  firstName?:   string;
  lastName?:    string;
  companyName:  string;
  location?:    string;
  linkedinUrl?: string;
}): Promise<{ phone?: string; email?: string; creditsUsed: number } | null> {
  const key = process.env.FULLENRICH_API_KEY;
  if (!key) return null;

  const reqParams: Record<string, string> = {
    company_name: params.companyName,
  };
  if (params.firstName)   reqParams.first_name   = params.firstName;
  if (params.lastName)    reqParams.last_name     = params.lastName;
  if (params.location)    reqParams.location      = params.location;
  if (params.linkedinUrl) reqParams.linkedin_url  = params.linkedinUrl;

  try {
    const res = await fetch("https://api.fullenrich.com/v1/enrich", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        requests: [{ params: reqParams }],
        reveal_phone_number: true,
        reveal_work_email:   true,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      console.error("[fullenrich] HTTP", res.status, await res.text());
      return null;
    }

    const data = await res.json() as FullEnrichResponse;
    const result = data.requests?.[0];
    if (!result || result.error) return null;

    const contact = result.contact;
    if (!contact) return null;

    // Privilégier le mobile, puis direct, puis work
    const phones = contact.phones ?? [];
    const mobile = phones.find((p) => p.type === "mobile")
      ?? phones.find((p) => p.type === "direct")
      ?? phones[0];

    // Email pro uniquement
    const emails = contact.emails ?? [];
    const email  = emails.find((e) => e.type === "work") ?? emails[0];

    const phone = mobile ? normalizePhone(mobile.number) : undefined;

    return {
      phone,
      email:       email?.email,
      creditsUsed: result.credits_used ?? (phone || email?.email ? 1 : 0),
    };
  } catch (err) {
    console.error("[fullenrich] error:", err);
    return null;
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { error: authError } = requireAuth(req);
  if (authError) return authError;

  if (!process.env.FULLENRICH_API_KEY) {
    return NextResponse.json({
      error:   "FULLENRICH_API_KEY non configurée",
      message: "Ajoutez FULLENRICH_API_KEY dans les variables d'environnement Vercel.",
    }, { status: 503 });
  }

  const body = await req.json() as {
    prospectId:         string;
    dirigeantPrincipal: string;
    nom:                string;  // nom de la société
    ville?:             string;
    linkedinDirigeant?: string;
  };

  const { prospectId, dirigeantPrincipal, nom, ville, linkedinDirigeant } = body;

  if (!prospectId || !nom) {
    return NextResponse.json({ error: "prospectId et nom requis" }, { status: 400 });
  }

  // Découper prénom / nom depuis le nom complet
  const parts     = (dirigeantPrincipal ?? "").trim().split(/\s+/);
  const firstName = parts.length > 1 ? parts.slice(0, -1).join(" ") : undefined;
  const lastName  = parts.length > 1 ? parts[parts.length - 1] : parts[0];
  const location  = ville ? `${ville}, France` : "France";

  try {
    const result = await callFullEnrich({
      firstName,
      lastName,
      companyName:  nom,
      location,
      linkedinUrl:  linkedinDirigeant,
    });

    if (!result || (!result.phone && !result.email)) {
      return NextResponse.json({ ok: false, found: false, message: "Aucune donnée trouvée par FullEnrich" });
    }

    // Persister les données enrichies
    const now   = new Date().toISOString();
    const patch: Record<string, unknown> = {
      fullEnrichEnrichedAt: now,
    };
    const actions: Array<{ date: string; type: string; detail: string }> = [];

    if (result.phone) {
      patch.telephoneMobile = result.phone;
      actions.push({ date: now, type: "enrichissement", detail: `Mobile FullEnrich : ${result.phone}` });
    }
    if (result.email) {
      patch.emailDirigeant = result.email;
      patch.emailSource    = "pappers"; // réutiliser "pappers" comme source B2B vérifiée
      patch.emailVerifie   = true;
      actions.push({ date: now, type: "enrichissement", detail: `Email FullEnrich : ${result.email}` });
    }
    if (actions.length > 0) patch.actions = actions;

    try {
      const { dbUpdateProspect } = await import("@/lib/db-prospection");
      await dbUpdateProspect(prospectId, patch as any);
    } catch (dbErr) {
      console.warn("[enrich-dirigeant] DB save skipped:", dbErr);
    }

    return NextResponse.json({
      ok:           true,
      found:        true,
      phone:        result.phone,
      email:        result.email,
      creditsUsed:  result.creditsUsed,
      message:      `Mobile${result.phone ? ` : ${result.phone}` : ""} — Email${result.email ? ` : ${result.email}` : ""}`,
    });
  } catch (err) {
    console.error("[enrich-dirigeant]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
