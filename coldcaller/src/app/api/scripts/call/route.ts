/**
 * GET  /api/scripts/call — retourne les sections du script d'appel
 * PUT  /api/scripts/call — sauvegarde les sections du script d'appel
 */

import { NextRequest, NextResponse } from "next/server";
import { dbGetCallScript, dbSaveCallScript } from "@/lib/db-scripts";
import type { CallScriptSection } from "@/lib/db-scripts";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sections = await dbGetCallScript();
    return NextResponse.json({ sections });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { sections } = await req.json() as { sections: CallScriptSection[] };
    if (!Array.isArray(sections)) {
      return NextResponse.json({ error: "sections must be an array" }, { status: 400 });
    }
    await dbSaveCallScript(sections);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
