import { NextRequest, NextResponse } from "next/server";
import { searchSirene } from "@/lib/sirene";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { dept, lat, lon, radius = 20, niche } = await req.json();
  if (!niche) {
    return NextResponse.json({ error: "niche required" }, { status: 400 });
  }

  const leads = await searchSirene(niche, dept ?? "", lat ?? 0, lon ?? 0, radius, 80);

  return NextResponse.json({ leads, total: leads.length });
}
