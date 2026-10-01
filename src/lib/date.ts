/**
 * Utilitaires de date orientes « journee utilisateur ».
 *
 * Toute la logique metier (habitudes, repas, prieres, statistiques) raisonne en
 * cles `YYYY-MM-DD` calculees dans le fuseau horaire de l'utilisateur, pas dans
 * celui du serveur. C'est ce qui garantit qu'un utilisateur a Tokyo et un autre
 * a Paris voient chacun leur propre « aujourd'hui ».
 */

export type DateKey = string; // "YYYY-MM-DD"

/** Cle du jour dans un fuseau donne (par defaut celui du serveur). */
export function dateKeyIn(timezone: string, at: Date = new Date()): DateKey {
  try {
    // en-CA produit nativement le format ISO court YYYY-MM-DD.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(at);
  } catch {
    return at.toISOString().slice(0, 10);
  }
}

/** Cle du jour pour un objet Date, sans conversion de fuseau. */
export function toDateKey(date: Date): DateKey {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Convertit une cle en Date a midi UTC (evite les glissements de fuseau). */
export function fromDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0));
}

export function addDaysToKey(key: DateKey, days: number): DateKey {
  const date = fromDateKey(key);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Liste inclusive de cles entre deux dates. */
export function dateKeyRange(from: DateKey, to: DateKey): DateKey[] {
  const keys: DateKey[] = [];
  let cursor = from;
  let guard = 0;
  while (cursor <= to && guard < 4000) {
    keys.push(cursor);
    cursor = addDaysToKey(cursor, 1);
    guard += 1;
  }
  return keys;
}

/** Les N derniers jours en terminant par `end` (inclus). */
export function lastNDays(n: number, end: DateKey): DateKey[] {
  return dateKeyRange(addDaysToKey(end, -(n - 1)), end);
}

export function daysBetween(from: DateKey, to: DateKey): number {
  const diff = fromDateKey(to).getTime() - fromDateKey(from).getTime();
  return Math.round(diff / 86_400_000);
}

/** Decalage (ms) entre l'heure murale d'un fuseau et UTC, a un instant donne. */
function zoneOffsetMs(timezone: string, at: Date): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(at);
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    const wall = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
    return wall - Math.floor(at.getTime() / 1000) * 1000;
  } catch {
    return 0;
  }
}

/** Instant UTC du minuit local d'une cle dans un fuseau (heure d'ete comprise). */
function zonedMidnight(key: DateKey, timezone: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  const guess = Date.UTC(y, (m ?? 1) - 1, d ?? 1);
  const first = guess - zoneOffsetMs(timezone, new Date(guess));
  // Second passage : le decalage peut differer de part et d'autre d'un changement d'heure.
  return new Date(guess - zoneOffsetMs(timezone, new Date(first)));
}

/**
 * Bornes [debut, fin] d'une journee LOCALE, exprimees en instants.
 *
 * Indispensable pour filtrer un horodatage (`completedAt`, `createdAt`) sur
 * « la journee de l'utilisateur » : des bornes `T00:00Z`/`T23:59Z` decoupent
 * la journee de Greenwich, decalee de plusieurs heures pour Paris ou Tokyo.
 */
export function dayBoundsIn(key: DateKey, timezone: string): { start: Date; end: Date } {
  const start = zonedMidnight(key, timezone);
  const end = new Date(zonedMidnight(addDaysToKey(key, 1), timezone).getTime() - 1);
  return { start, end };
}

/** Jour de la semaine (0 = dimanche) dans le fuseau de l'utilisateur. */
export function weekDayOf(key: DateKey): number {
  return fromDateKey(key).getUTCDay();
}

/** Debut de semaine (lundi) pour une cle donnee. */
export function startOfWeekKey(key: DateKey): DateKey {
  const day = weekDayOf(key);
  const offset = day === 0 ? -6 : 1 - day; // semaine ISO : lundi -> dimanche
  return addDaysToKey(key, offset);
}

export function startOfMonthKey(key: DateKey): DateKey {
  return `${key.slice(0, 7)}-01`;
}

/** Heure locale formatee pour l'utilisateur. */
export function formatTimeIn(timezone: string, format: '12h' | '24h', at: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: format === '12h',
    }).format(at);
  } catch {
    return at.toISOString().slice(11, 16);
  }
}

/** Age en annees a partir d'une date de naissance. */
export function ageFrom(birthDate: Date | null | undefined): number | null {
  if (!birthDate) return null;
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) age -= 1;
  return age;
}

/** Verifie qu'une chaine est bien une cle YYYY-MM-DD valide. */
export function isDateKey(value: unknown): value is DateKey {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = fromDateKey(value);
  return !Number.isNaN(date.getTime()) && value === date.toISOString().slice(0, 10);
}

/** Periodes proposees dans les pages Statistiques et Comparaison. */
export const COMPARE_PERIODS = {
  today: 1,
  yesterday: 1,
  '7d': 7,
  '30d': 30,
  '3m': 90,
  '6m': 180,
  '1y': 365,
  all: 3650,
} as const;

export type ComparePeriod = keyof typeof COMPARE_PERIODS;
