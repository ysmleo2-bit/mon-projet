#!/usr/bin/env node
/**
 * Purge RGPD : la CNIL recommande de ne pas conserver des données de
 * prospection au-delà de 3 ans sans interaction avec le prospect.
 *
 * Ce script lit directement data/leads.json (même format que src/lib/db.ts)
 * et supprime les leads :
 *  - jamais contactés ET détectés il y a plus de 3 ans
 *  - OU dont le dernier contact (lastContact) date de plus de 3 ans
 *
 * Usage :
 *   node scripts/purge-stale-leads.mjs            # dry-run (aucune suppression)
 *   node scripts/purge-stale-leads.mjs --confirm   # applique réellement la purge
 *
 * À planifier en cron (mensuel par ex.) :
 *   0 3 1 * *  cd /chemin/vers/coldcaller && npm run purge -- --confirm >> purge.log 2>&1
 */
import fs from "fs";
import path from "path";

const DB_FILE = path.join(process.cwd(), "data", "leads.json");
const THREE_YEARS_MS = 3 * 365 * 24 * 60 * 60 * 1000;
const cutoff = Date.now() - THREE_YEARS_MS;
const confirm = process.argv.includes("--confirm");

if (!fs.existsSync(DB_FILE)) {
  console.log(`Pas de fichier ${DB_FILE} — rien à purger.`);
  process.exit(0);
}

const data = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
const leads = data.leads ?? [];

const isStale = (lead) => {
  const referenceDate = lead.lastContact ?? lead.detectedAt;
  if (!referenceDate) return false;
  return new Date(referenceDate).getTime() < cutoff;
};

const stale = leads.filter(isStale);

console.log(`${stale.length} lead(s) sur ${leads.length} dépassent la durée de conservation de 3 ans sans interaction.`);

if (stale.length === 0) process.exit(0);

if (!confirm) {
  console.log("Mode dry-run (aucune suppression). Relance avec --confirm pour purger réellement ces leads :");
  for (const l of stale) {
    console.log(` - ${l.id} ${l.name} (détecté le ${l.detectedAt}, dernier contact: ${l.lastContact ?? "jamais"})`);
  }
  process.exit(0);
}

const staleIds = new Set(stale.map((l) => l.id));
data.leads = leads.filter((l) => !staleIds.has(l.id));
fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

console.log(`${stale.length} lead(s) supprimé(s) définitivement.`);
