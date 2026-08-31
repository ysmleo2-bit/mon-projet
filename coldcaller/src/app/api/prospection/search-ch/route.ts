/**
 * POST /api/prospection/search-ch
 * Recherche d'entreprises en Suisse via l'API officielle Zefix (Zentraler Firmenindex).
 * Registre fédéral suisse — gratuit, sans clé API, source officielle.
 *
 * Zefix REST API: https://www.zefix.ch/ZefixREST/api/v1/firm/search
 * searchType 2 = "contains" → cherche le mot-clé n'importe où dans le nom
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import type { Prospect } from "@/lib/types-prospection";

export const dynamic     = "force-dynamic";
export const maxDuration = 30;

// ── Types Zefix ───────────────────────────────────────────────────────────────
interface ZefixFirm {
  uid:                string;   // "CHE-xxx.xxx.xxx"
  name:               string;
  legalForm?:         { id: number; names?: Record<string, string> };
  seat?:              string;   // ville principale
  status?:            string;   // "ACTIVE" | "CANCELLED" | ...
  cantonAbbreviation?: string;
  purpose?:           Record<string, string>;
  address?: {
    street?:       string;
    houseNum?:     string;
    city?:         string;
    country?:      string;
    swissZipCode?: string;
  };
  communications?: {
    phonePrimary?: string;
    email?:        string;
    web?:          string;
  };
}

interface ZefixResponse {
  list?:       ZefixFirm[];
  maxEntries?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function uidToId(uid: string): string {
  // "CHE-xxx.xxx.xxx" → "CHExxxxxxxxxx"
  return "CHE" + uid.replace(/^CHE-/, "").replace(/\./g, "");
}

async function fetchZefix(keyword: string, canton: string, offset = 0): Promise<ZefixFirm[]> {
  try {
    const body: Record<string, unknown> = {
      name:       keyword,
      maxEntries: 25,
      offset,
      language:   "fr",
      searchType: 2, // contains
    };
    if (canton && canton !== "ALL") body.cantonAbbreviation = canton.toUpperCase();

    const res = await fetch("https://www.zefix.ch/ZefixREST/api/v1/firm/search", {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const json = await res.json() as ZefixResponse | ZefixFirm[];
    const list = Array.isArray(json) ? json : (json.list ?? []);
    // Garder seulement les entreprises actives
    return list.filter((f) => !f.status || f.status === "ACTIVE" || f.status === "INSCRIT");
  } catch {
    return [];
  }
}

function zefixToProspect(f: ZefixFirm, secteur: string, user?: { userId: string; name: string }): Prospect {
  const now = new Date().toISOString();
  const uid = uidToId(f.uid);
  const addr = [f.address?.street, f.address?.houseNum].filter(Boolean).join(" ");
  const phone = f.communications?.phonePrimary
    ? f.communications.phonePrimary.replace(/\s+/g, " ").trim()
    : undefined;
  const web = f.communications?.web
    ? f.communications.web.replace(/^https?:\/\//, "").replace(/\/$/, "")
    : undefined;
  const statut = web ? "a_enrichir" : "nouveau";

  return {
    id:                 `prospect-${uid}`,
    siren:              uid,
    nom:                f.name,
    codeNaf:            "",
    libelleNaf:         f.purpose?.fr ?? f.purpose?.de ?? "",
    secteur,
    adresse:            addr,
    ville:              f.address?.city ?? f.seat ?? "",
    codePostal:         f.address?.swissZipCode,
    departement:        f.cantonAbbreviation ?? "",
    siteWeb:            web,
    telephonePro:       phone,
    statut,
    dirigeants:         [],
    sources:            ["zefix"],
    actions:            [{ date: now, type: "enrichissement", detail: "Prospect créé depuis Zefix (CH)" }],
    createdAt:          now,
    updatedAt:          now,
    assignedToId:       user?.userId,
    assignedTo:         user?.name,
  };
}

export async function POST(req: NextRequest) {
  const { user, error: authError } = requireAuth(req);
  if (authError) return authError;

  const body = await req.json() as { keyword?: string; secteur?: string; canton?: string; perPage?: number };
  const { keyword = "", secteur = keyword, canton = "ALL", perPage = 50 } = body;

  if (!keyword.trim()) {
    return NextResponse.json({ error: "keyword requis" }, { status: 400 });
  }

  try {
    // Plusieurs offsets pour obtenir plus de résultats (25 / page Zefix)
    const pages = Math.ceil(Math.min(perPage, 100) / 25);
    const fetches = Array.from({ length: pages }, (_, i) =>
      fetchZefix(keyword, canton, i * 25)
    );
    const results = (await Promise.all(fetches)).flat();

    // Déduplique par UID
    const seen   = new Set<string>();
    const unique = results.filter((f) => {
      if (!f.uid || seen.has(f.uid)) return false;
      seen.add(f.uid); return true;
    });

    const prospects = unique.slice(0, perPage).map((f) =>
      zefixToProspect(f, secteur, user ?? undefined)
    );

    // Sauvegarder en DB
    let merged = prospects;
    try {
      const { dbUpsertProspects, dbGetProspectsByIds } = await import("@/lib/db-prospection");
      await dbUpsertProspects(prospects);
      const dbMap = await dbGetProspectsByIds(prospects.map((p) => p.id));
      merged = prospects.map((p) => dbMap.get(p.id) ?? p);
    } catch (dbErr) {
      console.warn("[search-ch] DB save skipped:", dbErr);
    }

    return NextResponse.json({ prospects: merged, total: merged.length, raw: unique.length, source: "zefix" });
  } catch (err) {
    console.error("[search-ch]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
