import { NextRequest, NextResponse } from "next/server";
import { dbGetLead, dbUpdateLead } from "@/lib/db";
import { normalizePhone } from "@/lib/compliance";
import { addToBlacklist } from "@/lib/blacklist";

export const dynamic = "force-dynamic";

// POST /api/leads/:id/optout
// Le prospect s'oppose à être recontacté (droit d'opposition RGPD).
// Marque le lead ET ajoute son numéro à la liste noire globale : il ne
// sera plus jamais proposé à l'appel, même via une future campagne de
// scraping (voir src/lib/blacklist.ts).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const lead = await dbGetLead(params.id);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const reason = (body as { reason?: string })?.reason || "opt-out demandé par le prospect";

  const phoneNormalized = normalizePhone(lead.phone);
  if (phoneNormalized) addToBlacklist(phoneNormalized, reason);

  const updated = await dbUpdateLead(params.id, {
    doNotCall:   true,
    doNotCallAt: new Date().toISOString(),
  });

  return NextResponse.json({ lead: updated });
}
