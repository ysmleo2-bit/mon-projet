/**
 * Garde-fous de conformité pour la prospection téléphonique B2B en France
 * (loi démarchage téléphonique applicable au 11/08/2026 + RGPD art. 6.1.f
 * "intérêt légitime" pour le B2B).
 *
 * Ceci n'est PAS un avis juridique. Fais valider ton process par un juriste
 * avant un usage commercial réel, en particulier si tu démarches aussi des
 * particuliers (B2C), soumis à des règles beaucoup plus strictes
 * (consentement préalable requis).
 */

// Créneaux autorisés : lundi-vendredi, 10h-13h et 14h-20h, heure de Paris.
const ALLOWED_WINDOWS: Array<[number, number]> = [
  [10 * 60, 13 * 60], // 10:00 - 13:00
  [14 * 60, 20 * 60], // 14:00 - 20:00
];

// Jours fériés français à tenir à jour manuellement (format YYYY-MM-DD).
const PUBLIC_HOLIDAYS = new Set<string>([
  // '2026-01-01', '2026-05-01', ...
]);

export interface CallWindowStatus {
  open: boolean;
  reason: string | null;
}

function getParisParts(date: Date) {
  const fmt = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value])) as Record<string, string>;
}

export function isCallingWindowOpen(date: Date = new Date()): CallWindowStatus {
  const parts = getParisParts(date);
  const isoDate = `${parts.year}-${parts.month}-${parts.day}`;
  if (PUBLIC_HOLIDAYS.has(isoDate)) {
    return { open: false, reason: 'Jour férié' };
  }

  const weekdayMap: Record<string, number> = { lun: 1, mar: 2, mer: 3, jeu: 4, ven: 5, sam: 6, dim: 0 };
  const weekdayKey = parts.weekday.replace('.', '').toLowerCase().slice(0, 3);
  const weekday = weekdayMap[weekdayKey];
  if (weekday === 0 || weekday === 6) {
    return { open: false, reason: 'Weekend' };
  }

  const minutesOfDay = parseInt(parts.hour, 10) * 60 + parseInt(parts.minute, 10);
  const inWindow = ALLOWED_WINDOWS.some(([start, end]) => minutesOfDay >= start && minutesOfDay < end);
  if (!inWindow) {
    return { open: false, reason: 'Hors créneau autorisé (10h-13h / 14h-20h, jours ouvrés)' };
  }

  return { open: true, reason: null };
}

/**
 * Normalise un numéro de téléphone français vers un format comparable
 * (0XXXXXXXXX). Renvoie null si la chaîne ne contient aucun chiffre.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  if (digits.startsWith('0033')) digits = digits.slice(4);
  else if (digits.startsWith('33') && digits.length === 11) digits = digits.slice(2);

  if (digits.length === 9 && !digits.startsWith('0')) digits = `0${digits}`;

  if (digits.length !== 10 || !digits.startsWith('0')) {
    return digits;
  }
  return digits;
}
