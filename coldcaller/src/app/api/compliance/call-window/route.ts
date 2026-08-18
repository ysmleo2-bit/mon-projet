import { NextResponse } from "next/server";
import { isCallingWindowOpen } from "@/lib/compliance";

export const dynamic = "force-dynamic";

// GET /api/compliance/call-window
// Indique si on est actuellement dans un créneau légal d'appel B2B en
// France (lun-ven 10h-13h / 14h-20h, heure de Paris). Voir lib/compliance.ts.
export async function GET() {
  return NextResponse.json(isCallingWindowOpen());
}
