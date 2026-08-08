import { NextRequest, NextResponse } from "next/server";
import { dbUpsertLeads } from "@/lib/db";
import type { Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

// Noms réalistes par secteur
const NAMES_BY_CAT: Record<string, string[]> = {
  Plombier:      ["Dupont Plomberie","Martin Sanitaire","Lefèvre Plomb","Bernard Eau","Rousseau Plomb"],
  Électricien:   ["Élec Martin","Voltaire Elec","Girard Électricité","Petit Courant","Simon Elec"],
  Maçon:         ["Maçonnerie Blanc","Bâtisseurs Moreau","Murs & Co","Bernard TP","Solide Béton"],
  Serrurier:     ["Serrurier Express","Cléo Serrurerie","Ouverture Rapide","Fontaine Serrures","24h Serrurerie"],
  Peintre:       ["Peinture Élégance","Couleurs Moreau","Décor Dubois","Peint'Art","Brosse & Co"],
  Couvreur:      ["Toitures Bernard","Ardoise & Tuile","Couverture Martin","Sous la Pluie","Toits du Rhône"],
  Carreleur:     ["Carrelage Fontaine","Mosaïc Pro","Sol & Mur","Granit Pose","Carrel'Art"],
  Menuisier:     ["Menuiserie Girard","Bois & Design","Ébénisterie Petit","Chêne & Noyer","Artisans du Bois"],
  Chauffagiste:  ["Chauffage Rousseau","Clim & Chauf","Confort Thermique","Chaleur Pro","Héat Expert"],
  Paysagiste:    ["Paysages Blanc","Vert Nature","Jardins du Rhône","Espaces Verts Pro","Flore & Jardin"],
  Nettoyage:     ["Nettoyage Pro","Éclat Net","Shine & Clean","Propreté Martin","Net Express"],
  Restaurant:    ["Le Bistrot du Coin","La Table Française","Chez Marco","Le Gourmet","Saveurs & Co"],
  Boulangerie:   ["Boulangerie Dupont","Au Bon Pain","La Mie Dorée","Pains Artisanaux","Farine & Beurre"],
  Coiffeur:      ["Coiff'Art","Les Ciseaux d'Or","Hair Studio","Atelier Cheveux","Coiffure Élégance"],
  Comptable:     ["Cabinet Legrand","Chiffres & Co","Expert Compta","Fiscal Pro","Révision Comptable"],
};

const STREETS = [
  "rue de la Paix","avenue du Général de Gaulle","boulevard Victor Hugo",
  "chemin des Acacias","impasse des Lilas","rue Gambetta","avenue Foch",
  "rue du Commerce","place de la République","rue de la Liberté",
  "avenue Jean Jaurès","rue Henri IV","boulevard des Brotteaux",
];

function phone(): string {
  const parts = [
    "06","07"
  ][Math.floor(Math.random()*2)];
  const tail = Array.from({length:4},()=>String(Math.floor(10+Math.random()*90))).join(" ");
  return `${parts} ${tail}`;
}

function generateLeads(niche: string, city: string, count: number): Lead[] {
  const pool  = NAMES_BY_CAT[niche] ?? [`${niche} Expert`];
  const now   = new Date().toISOString();
  const leads: Lead[] = [];

  for (let i = 0; i < count; i++) {
    const baseName = pool[i % pool.length];
    const suffix   = i >= pool.length ? ` ${i + 1}` : "";
    const hasWeb   = Math.random() > 0.45;
    leads.push({
      id:           `sc-${Date.now()}-${i}`,
      name:         baseName + suffix,
      category:     niche,
      phone:        phone(),
      address:      `${Math.floor(1+Math.random()*200)} ${STREETS[i%STREETS.length]}`,
      city,
      rating:       Math.round((3.2 + Math.random() * 1.8) * 10) / 10,
      reviewCount:  Math.floor(3 + Math.random() * 600),
      website:      hasWeb ? `${baseName.toLowerCase().replace(/[^a-z0-9]/g,"-").replace(/-+/g,"-")}.fr` : undefined,
      status:       "new",
      notes:        "",
      detectedAt:   now,
      source:       "google_maps",
      callCount:    0,
    });
  }
  return leads;
}

// POST /api/scrape
// Body: { niche, city, radius, minRating }
export async function POST(req: NextRequest) {
  const { niche, city, radius = 20, minRating = 0 } = await req.json();

  if (!niche || !city) {
    return NextResponse.json({ error: "niche and city are required" }, { status: 400 });
  }

  // Simule un délai réseau réaliste (scraping)
  await new Promise((r) => setTimeout(r, 1200 + Math.random() * 800));

  const raw   = generateLeads(niche, city, Math.floor(60 + Math.random() * 440));
  const leads = raw.filter((l) => l.rating >= minRating);

  // Persister automatiquement dans la DB
  dbUpsertLeads(leads);

  return NextResponse.json({
    leads,
    total:  leads.length,
    query:  { niche, city, radius, minRating },
    source: "google_maps_simulation",
  });
}
