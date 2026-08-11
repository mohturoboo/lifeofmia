import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { ok, ApiError } from '@/lib/api/response';
import { prayerLogSchema, prayerSettingsSchema } from '@/lib/validation/modules';
import { dateKeyIn, isDateKey, startOfMonthKey } from '@/lib/date';
import { currentAndNext, PRAYER_METHODS } from '@/lib/prayer';
import { getPrayerTimes, prayerSettingsFor } from '@/lib/prayer-service';
import { formatTimeIn } from '@/lib/date';
import { recomputeDay } from '@/lib/stats';
import { awardXp, evaluateBadges } from '@/lib/gamification';

/**
 * GET /api/prayers?date=YYYY-MM-DD
 *
 * Les horaires sont calcules pour la position exacte de l'utilisateur. Changer
 * de ville dans les reglages met a jour `latitude`/`longitude`, et cette route
 * renvoie alors automatiquement les nouveaux horaires — aucune action
 * supplementaire n'est requise.
 */
export const GET = route(async ({ user, searchParams }) => {
  const raw = searchParams.get('date');
  const date = isDateKey(raw) ? raw : dateKeyIn(user.timezone);

  const settings = await prayerSettingsFor(user.id);

  const monthStart = startOfMonthKey(date);

  const [result, logs, monthLogs] = await Promise.all([
    // Meme service que le tableau de bord : les deux ne peuvent plus diverger.
    getPrayerTimes(user, date),
    prisma.prayerLog.findMany({ where: { userId: user.id, date } }),
    prisma.prayerLog.findMany({
      where: { userId: user.id, date: { gte: monthStart, lte: date } },
      select: { date: true, name: true, status: true },
    }),
  ]);

  /*
   * Sans coordonnees exploitables, le service renonce plutot que de retomber
   * sur une capitale arbitraire. On le dit explicitement : des horaires faux
   * seraient pires qu'une absence d'horaires.
   */
  if (!result) {
    throw new ApiError(
      'VALIDATION',
      'Horaires indisponibles : renseignez votre ville dans les reglages.',
      { city: 'Ville inconnue ou sans coordonnees.' },
    );
  }

  const nowHHmm = formatTimeIn(user.timezone, '24h');
  const { current, next, minutesToNext } = currentAndNext(result.times, nowHHmm);

  // Assiduite du mois : prieres accomplies sur le total theorique (5 par jour
  // depuis le 1er du mois jusqu'a la date consultee).
  const daysElapsed = Number(date.slice(8, 10));
  const expected = Math.max(1, daysElapsed * 5);
  const performed = monthLogs.filter((log) => log.status !== 'missed').length;

  return ok({
    date,
    times: result.times,
    source: result.source,
    current,
    next,
    minutesToNext,
    logs,
    settings: {
      method: settings.method,
      school: settings.school,
      notifyBefore: settings.notifyBefore,
      notifications: settings.notifications,
    },
    methods: PRAYER_METHODS.map((method) => ({ id: method.id, name: method.name })),
    location: {
      city: user.city,
      country: user.country,
      latitude: result.latitude,
      longitude: result.longitude,
      timezone: user.timezone,
    },
    monthlyRate: Math.min(100, Math.round((performed / expected) * 100)),
    monthLogs,
  });
});

/** POST /api/prayers — enregistre l'accomplissement d'une priere. */
export const POST = route(
  async ({ user, body }) => {
    const existing = await prisma.prayerLog.findUnique({
      where: { userId_date_name: { userId: user.id, date: body.date, name: body.name } },
      select: { id: true, status: true },
    });

    const log = await prisma.prayerLog.upsert({
      where: { userId_date_name: { userId: user.id, date: body.date, name: body.name } },
      create: { userId: user.id, date: body.date, name: body.name, status: body.status },
      update: { status: body.status },
    });

    // XP uniquement au premier enregistrement non manque de cette priere.
    if (body.status !== 'missed' && (!existing || existing.status === 'missed')) {
      await awardXp(user.id, body.status === 'done' ? 8 : 4, `Priere : ${body.name}`, 'prayer');
      await evaluateBadges(user.id);
    }

    await recomputeDay(user.id, body.date);
    return ok(log);
  },
  { schema: prayerLogSchema },
);

/** PATCH /api/prayers — reglages de calcul (methode, madhhab, notifications). */
export const PATCH = route(
  async ({ user, body }) => {
    const settings = await prisma.prayerSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...body },
      update: body,
    });
    return ok(settings);
  },
  { schema: prayerSettingsSchema },
);
