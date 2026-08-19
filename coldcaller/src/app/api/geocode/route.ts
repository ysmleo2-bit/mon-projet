import { NextRequest, NextResponse } from "next/server";
import { geocodeCity } from "@/lib/overpass";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { city } = await req.json();
  if (!city) return NextResponse.json({ error: "city required" }, { status: 400 });

  const coords = await geocodeCity(city);
  if (!coords) return NextResponse.json({ error: `Ville introuvable : ${city}` }, { status: 422 });

  return NextResponse.json(coords);
}
