/**
 * GET    /api/prospection/templates       — liste tous les modèles
 * POST   /api/prospection/templates       — crée un modèle
 * PATCH  /api/prospection/templates       — met à jour un modèle
 * DELETE /api/prospection/templates       — supprime un modèle
 */

import { NextRequest, NextResponse } from "next/server";
import {
  dbGetTemplates,
  dbCreateTemplate,
  dbUpdateTemplate,
  dbDeleteTemplate,
} from "@/lib/db-templates";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const templates = await dbGetTemplates();
    return NextResponse.json({ templates });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, subject, body } = await req.json() as {
      name: string; subject: string; body: string;
    };
    if (!name || !subject || !body) {
      return NextResponse.json({ error: "name, subject et body requis" }, { status: 400 });
    }
    const template = await dbCreateTemplate({ name, subject, body });
    return NextResponse.json({ ok: true, template });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, patch } = await req.json() as { id: string; patch: Record<string, unknown> };
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
    const template = await dbUpdateTemplate(id, patch as any);
    return NextResponse.json({ ok: true, template });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json() as { id: string };
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
    const ok = await dbDeleteTemplate(id);
    return NextResponse.json({ ok });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
