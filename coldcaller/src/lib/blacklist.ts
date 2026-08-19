/**
 * Liste noire globale ("ne plus jamais appeler"), persistée en JSON comme
 * le reste de la DB de ce projet (voir lib/db.ts). Un numéro qui atterrit
 * ici ne doit plus jamais être proposé à l'appel, y compris via une future
 * campagne de scraping.
 */
import fs from 'fs';
import path from 'path';

const DB_DIR  = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'blacklist.json');

export interface BlacklistEntry {
  phoneNormalized: string;
  reason: string;
  createdAt: string;
}

function read(): BlacklistEntry[] {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2));
    return [];
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

function write(entries: BlacklistEntry[]) {
  fs.writeFileSync(DB_FILE, JSON.stringify(entries, null, 2));
}

export function isBlacklisted(phoneNormalized: string | null): boolean {
  if (!phoneNormalized) return false;
  return read().some((e) => e.phoneNormalized === phoneNormalized);
}

export function addToBlacklist(phoneNormalized: string, reason = 'opt-out'): BlacklistEntry {
  const entries = read();
  const existing = entries.find((e) => e.phoneNormalized === phoneNormalized);
  if (existing) return existing;
  const entry: BlacklistEntry = { phoneNormalized, reason, createdAt: new Date().toISOString() };
  entries.push(entry);
  write(entries);
  return entry;
}

export function getBlacklist(): BlacklistEntry[] {
  return read();
}
