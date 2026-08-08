/**
 * Base de données persistante — fichier JSON sur le serveur.
 * Toutes les données survivent aux rechargements et redémarrages.
 */
import fs   from "fs";
import path from "path";
import type { Lead } from "./types";

const DB_DIR  = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "leads.json");

// ── Helpers ──────────────────────────────────────────────────────────────────

function read(): { leads: Lead[] } {
  if (!fs.existsSync(DB_DIR))  fs.mkdirSync(DB_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const seed = { leads: seedLeads() };
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2));
    return seed;
  }
  return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
}

function write(data: { leads: Lead[] }) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ── Public API ────────────────────────────────────────────────────────────────

export function dbGetLeads(): Lead[] {
  return read().leads;
}

export function dbGetLead(id: string): Lead | undefined {
  return read().leads.find((l) => l.id === id);
}

export function dbUpsertLeads(incoming: Lead[]): Lead[] {
  const data  = read();
  const byId  = new Map(data.leads.map((l) => [l.id, l]));
  for (const lead of incoming) byId.set(lead.id, lead);
  data.leads  = Array.from(byId.values());
  write(data);
  return data.leads;
}

export function dbUpdateLead(id: string, patch: Partial<Lead>): Lead | null {
  const data = read();
  const idx  = data.leads.findIndex((l) => l.id === id);
  if (idx < 0) return null;
  data.leads[idx] = { ...data.leads[idx], ...patch };
  write(data);
  return data.leads[idx];
}

export function dbDeleteLead(id: string): boolean {
  const data = read();
  const before = data.leads.length;
  data.leads = data.leads.filter((l) => l.id !== id);
  write(data);
  return data.leads.length < before;
}

// ── Seed data ─────────────────────────────────────────────────────────────────

function ago(min: number) { return new Date(Date.now() - min * 60_000).toISOString(); }

function seedLeads(): Lead[] {
  return [
    { id:"s001", name:"Plomberie Dupont",      category:"Plombier",     phone:"06 12 34 56 78", address:"12 rue Victor Hugo",   city:"Lyon",        rating:4.3, reviewCount:87,  website:"plomberie-dupont.fr",    status:"new",       notes:"",                                       detectedAt:ago(5),   source:"google_maps", callCount:0 },
    { id:"s002", name:"Électricité Martin",     category:"Électricien",  phone:"06 87 65 43 21", address:"45 av. Berthelot",     city:"Lyon",        rating:4.7, reviewCount:134, website:"elec-martin.fr",         status:"new",       notes:"",                                       detectedAt:ago(8),   source:"google_maps", callCount:0 },
    { id:"s003", name:"Maçonnerie Lefèvre",     category:"Maçon",        phone:"06 55 44 33 22", address:"8 impasse des Lilas",  city:"Villeurbanne",rating:3.9, reviewCount:23,                                    status:"new",       notes:"",                                       detectedAt:ago(12),  source:"google_maps", callCount:0 },
    { id:"s004", name:"Serrurier Express Lyon", category:"Serrurier",    phone:"06 11 22 33 44", address:"5 rue Garibaldi",      city:"Lyon",        rating:4.5, reviewCount:210,                                   status:"contacted", notes:"Pas répondu — rappeler en fin d'après-midi", lastContact:ago(120), detectedAt:ago(180), source:"google_maps", callCount:1 },
    { id:"s005", name:"Peinture Moreau",        category:"Peintre",      phone:"06 99 88 77 66", address:"23 bd des Brotteaux", city:"Lyon",        rating:4.2, reviewCount:56,                                    status:"contacted", notes:"Intéressé mais occupé. Rappeler jeudi",      lastContact:ago(240), detectedAt:ago(300), source:"google_maps", callCount:2 },
    { id:"s006", name:"Chauffage Rousseau",     category:"Chauffagiste", phone:"06 22 33 44 55", address:"6 bd Vivier-Merle",   city:"Lyon",        rating:4.6, reviewCount:189,                                   status:"interested",notes:"Veut une démo. Rappeler lundi 10h",          lastContact:ago(1440),detectedAt:ago(1500),source:"google_maps", callCount:3 },
    { id:"s007", name:"Isolation Petit",        category:"Artisan RGE",  phone:"06 44 55 66 77", address:"14 rue Paul Bert",    city:"Lyon",        rating:4.9, reviewCount:421,                                   status:"interested",notes:"Très chaud. Envoyer offre par mail",         lastContact:ago(1080),detectedAt:ago(1200),source:"google_maps", callCount:2 },
    { id:"s008", name:"Paysagiste Blanc",       category:"Paysagiste",   phone:"06 66 77 88 99", address:"3 chemin des Chênes", city:"Caluire",     rating:4.5, reviewCount:96,                                    status:"rdv",       notes:"RDV Teams mercredi 14h ✅",                  rdvDate:new Date(Date.now()+2*86400000).toISOString(), lastContact:ago(720), detectedAt:ago(2880), source:"google_maps", callCount:4 },
    { id:"s009", name:"Nettoyage Pro Dubois",   category:"Nettoyage",    phone:"06 11 33 55 77", address:"7 rue Tête d'Or",    city:"Lyon",        rating:4.7, reviewCount:203,                                   status:"client",    notes:"Abonné Starter depuis 2 semaines 🎉",       lastContact:ago(7200),detectedAt:ago(10080),source:"google_maps",callCount:5 },
    { id:"s010", name:"Plomberie Richard",      category:"Plombier",     phone:"06 22 44 66 88", address:"11 rue de Sèze",     city:"Lyon",        rating:3.6, reviewCount:12,                                    status:"lost",      notes:"Pas intéressé pour le moment",               lastContact:ago(4320),detectedAt:ago(5760), source:"google_maps", callCount:2 },
  ];
}
