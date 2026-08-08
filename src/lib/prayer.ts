import { env } from '@/lib/env';
import type { DateKey } from '@/lib/date';

/**
 * Horaires de priere.
 *
 * Deux sources, dans cet ordre :
 *  1. l'API publique AlAdhan (referentiel largement utilise, aucune cle requise) ;
 *  2. un calcul astronomique local, qui prend le relais si le reseau est
 *     indisponible — l'application reste ainsi utilisable hors ligne.
 *
 * Le calcul local suit l'algorithme classique « PrayTimes » : position solaire
 * (declinaison + equation du temps), puis resolution de l'angle horaire pour
 * chaque priere.
 */

export const PRAYERS = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;
export type PrayerName = (typeof PRAYERS)[number];

export type PrayerTimes = Record<PrayerName, string>; // "HH:mm"

export interface PrayerMethod {
  id: number;
  name: string;
  fajr: number; // angle crepusculaire du matin
  isha: number | { minutes: number }; // angle, ou minutes apres Maghrib
}

/** Sous-ensemble des methodes AlAdhan, avec les angles equivalents en local. */
export const PRAYER_METHODS: PrayerMethod[] = [
  { id: 3, name: 'Muslim World League', fajr: 18, isha: 17 },
  { id: 2, name: 'ISNA (Amerique du Nord)', fajr: 15, isha: 15 },
  { id: 5, name: 'Egyptian General Authority', fajr: 19.5, isha: 17.5 },
  { id: 4, name: 'Umm Al-Qura (La Mecque)', fajr: 18.5, isha: { minutes: 90 } },
  { id: 1, name: 'University of Karachi', fajr: 18, isha: 18 },
  { id: 12, name: 'UOIF (France, 12 degres)', fajr: 12, isha: 12 },
  { id: 99, name: 'Union des Organisations Islamiques de France (15 deg)', fajr: 15, isha: 15 },
];

export function methodById(id: number): PrayerMethod {
  return PRAYER_METHODS.find((method) => method.id === id) ?? PRAYER_METHODS[0];
}

// --- Trigonometrie en degres -------------------------------------------------

const dtr = (d: number) => (d * Math.PI) / 180;
const rtd = (r: number) => (r * 180) / Math.PI;
const sin = (d: number) => Math.sin(dtr(d));
const cos = (d: number) => Math.cos(dtr(d));
const tan = (d: number) => Math.tan(dtr(d));
const arcsin = (x: number) => rtd(Math.asin(x));
const arccos = (x: number) => rtd(Math.acos(x));
const arctan2 = (y: number, x: number) => rtd(Math.atan2(y, x));
const arccot = (x: number) => rtd(Math.atan(1 / x));

const fixAngle = (a: number) => ((a % 360) + 360) % 360;
const fixHour = (h: number) => ((h % 24) + 24) % 24;

function julianDate(year: number, month: number, day: number): number {
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const a = Math.floor(year / 100);
  const b = 2 - a + Math.floor(a / 4);
  return (
    Math.floor(365.25 * (year + 4716)) +
    Math.floor(30.6001 * (month + 1)) +
    day +
    b -
    1524.5
  );
}

function sunPosition(jd: number): { declination: number; equationOfTime: number } {
  const d = jd - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * d);
  const q = fixAngle(280.459 + 0.98564736 * d);
  const l = fixAngle(q + 1.915 * sin(g) + 0.02 * sin(2 * g));
  const e = 23.439 - 0.00000036 * d;

  const rightAscension = fixHour(arctan2(cos(e) * sin(l), cos(l)) / 15);
  return {
    declination: arcsin(sin(e) * sin(l)),
    equationOfTime: q / 15 - rightAscension,
  };
}

/**
 * Calcul local des horaires pour une date, une position et une methode.
 * `timezoneOffsetHours` doit correspondre au decalage effectif ce jour-la
 * (heure d'ete comprise).
 */
export function computePrayerTimes(options: {
  date: DateKey;
  latitude: number;
  longitude: number;
  timezoneOffsetHours: number;
  method?: number;
  school?: 0 | 1; // 0 = Shafi (ombre x1), 1 = Hanafi (ombre x2)
}): PrayerTimes {
  const { latitude, longitude, timezoneOffsetHours } = options;
  const method = methodById(options.method ?? 3);
  const shadowFactor = options.school === 1 ? 2 : 1;

  const [year, month, day] = options.date.split('-').map(Number);
  const jd = julianDate(year, month, day) - longitude / (15 * 24);
  const { declination, equationOfTime } = sunPosition(jd);

  const noon = fixHour(12 - equationOfTime);

  /** Heure a laquelle le soleil atteint un angle donne sous l'horizon. */
  function angleTime(angle: number, direction: 'before' | 'after'): number {
    const numerator = -sin(angle) - sin(declination) * sin(latitude);
    const denominator = cos(declination) * cos(latitude);
    const ratio = numerator / denominator;
    // Aux latitudes extremes le soleil ne franchit jamais l'angle demande :
    // on retombe alors sur une approximation a 1/7 de la nuit (regle courante).
    if (ratio > 1 || ratio < -1) return Number.NaN;
    const hourAngle = arccos(ratio) / 15;
    return direction === 'before' ? noon - hourAngle : noon + hourAngle;
  }

  function asrTime(): number {
    const angle = -arccot(shadowFactor + tan(Math.abs(latitude - declination)));
    return angleTime(angle, 'after');
  }

  /*
   * Au-dela des cercles polaires, le soleil peut ne jamais franchir un angle
   * donne : lever et coucher deviennent alors indefinis, et pas seulement Fajr
   * et Isha. On se rabat dans ce cas sur une journee nominale de 12 heures
   * centree sur le midi solaire, ce qui donne une nuit exploitable par la regle
   * du « septieme de nuit » appliquee juste apres.
   */
  const rawSunrise = angleTime(0.833, 'before');
  const rawSunset = angleTime(0.833, 'after');
  const polar = Number.isNaN(rawSunrise) || Number.isNaN(rawSunset);
  const sunrise = polar ? noon - 6 : rawSunrise;
  const sunset = polar ? noon + 6 : rawSunset;

  let fajr = angleTime(method.fajr, 'before');
  let isha =
    typeof method.isha === 'number'
      ? angleTime(method.isha, 'after')
      : sunset + method.isha.minutes / 60;

  // Ajustement « septieme de nuit » pour les hautes latitudes.
  if (Number.isNaN(fajr) || Number.isNaN(isha)) {
    const nightLength = fixHour(sunrise - sunset + 24);
    const portion = nightLength / 7;
    if (Number.isNaN(fajr)) fajr = sunrise - portion;
    if (Number.isNaN(isha)) isha = sunset + portion;
  }

  const toLocal = (hours: number) => hours + timezoneOffsetHours - longitude / 15;

  const format = (hours: number): string => {
    if (!Number.isFinite(hours)) return '--:--';
    const total = Math.round(fixHour(hours) * 60);
    const h = Math.floor(total / 60) % 24;
    const m = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  return {
    Fajr: format(toLocal(fajr)),
    Sunrise: format(toLocal(sunrise)),
    Dhuhr: format(toLocal(noon + 1 / 60)), // +1 min : le zenith exact n'est pas encore Dhuhr
    Asr: format(toLocal(asrTime())),
    Maghrib: format(toLocal(sunset)),
    Isha: format(toLocal(isha)),
  };
}

/** Decalage horaire effectif (en heures) d'un fuseau IANA a une date donnee. */
export function timezoneOffsetHours(timezone: string, date: Date = new Date()): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'longOffset',
    });
    const part = formatter.formatToParts(date).find((p) => p.type === 'timeZoneName')?.value ?? '';
    const match = part.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!match) return 0;
    const sign = match[1] === '-' ? -1 : 1;
    return sign * (Number(match[2]) + Number(match[3] ?? 0) / 60);
  } catch {
    return 0;
  }
}

/**
 * Recupere les horaires via AlAdhan, avec repli sur le calcul local.
 * Un cache Next de 12 h evite de solliciter l'API a chaque affichage.
 */
export async function fetchPrayerTimes(options: {
  date: DateKey;
  latitude: number;
  longitude: number;
  timezone: string;
  method?: number;
  school?: 0 | 1;
}): Promise<{ times: PrayerTimes; source: 'aladhan' | 'local' }> {
  const [year, month, day] = options.date.split('-');
  const url = new URL(`${env.aladhanApiUrl}/timings/${day}-${month}-${year}`);
  url.searchParams.set('latitude', String(options.latitude));
  url.searchParams.set('longitude', String(options.longitude));
  url.searchParams.set('method', String(options.method ?? 3));
  url.searchParams.set('school', String(options.school ?? 0));
  url.searchParams.set('timezonestring', options.timezone);

  try {
    const response = await fetch(url, {
      next: { revalidate: 43_200 },
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      const payload = (await response.json()) as {
        data?: { timings?: Record<string, string> };
      };
      const timings = payload.data?.timings;
      if (timings) {
        const clean = (value?: string) => (value ?? '--:--').split(' ')[0].slice(0, 5);
        return {
          source: 'aladhan',
          times: {
            Fajr: clean(timings.Fajr),
            Sunrise: clean(timings.Sunrise),
            Dhuhr: clean(timings.Dhuhr),
            Asr: clean(timings.Asr),
            Maghrib: clean(timings.Maghrib),
            Isha: clean(timings.Isha),
          },
        };
      }
    }
  } catch {
    // Reseau indisponible ou API en erreur : on bascule sur le calcul local.
  }

  return {
    source: 'local',
    times: computePrayerTimes({
      ...options,
      timezoneOffsetHours: timezoneOffsetHours(options.timezone, new Date(`${options.date}T12:00:00Z`)),
    }),
  };
}

/** Determine la priere en cours et la suivante a partir de l'heure locale. */
export function currentAndNext(
  times: PrayerTimes,
  nowHHmm: string,
): { current: PrayerName | null; next: PrayerName | null; minutesToNext: number | null } {
  const toMinutes = (value: string) => {
    const [h, m] = value.split(':').map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : Number.NaN;
  };

  const now = toMinutes(nowHHmm);
  const order: PrayerName[] = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  const entries = order
    .map((name) => ({ name, minutes: toMinutes(times[name]) }))
    .filter((entry) => Number.isFinite(entry.minutes));

  if (entries.length === 0) return { current: null, next: null, minutesToNext: null };

  let current: PrayerName | null = null;
  let next: PrayerName | null = null;

  for (const entry of entries) {
    if (entry.minutes <= now) current = entry.name;
    else if (!next) next = entry.name;
  }

  // Apres Isha, la prochaine priere est le Fajr du lendemain.
  if (!next) {
    next = 'Fajr';
    const minutesToNext = 24 * 60 - now + entries[0].minutes;
    return { current, next, minutesToNext };
  }

  return {
    current,
    next,
    minutesToNext: Math.max(0, toMinutes(times[next]) - now),
  };
}
