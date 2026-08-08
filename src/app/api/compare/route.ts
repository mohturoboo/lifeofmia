import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { RATE_LIMITS } from '@/lib/auth/rate-limit';
import { ok } from '@/lib/api/response';
import { addDaysToKey, dateKeyIn, dateKeyRange, lastNDays, COMPARE_PERIODS, type ComparePeriod } from '@/lib/date';
import { aggregate, readRange } from '@/lib/stats';
import { buildMetrics, buildRadar } from '@/lib/analytics';

/**
 * GET /api/compare?period=7d|30d|3m|6m|1y|all
 *
 * Compare la periode courante a la periode immediatement precedente de meme
 * duree. Comparer « les 30 derniers jours » aux « 30 jours d'avant » est la
 * seule facon de savoir si l'on progresse reellement, plutot que de regarder un
 * chiffre absolu qui ne dit rien du sens de la trajectoire.
 */

export const GET = route(async ({ user, searchParams }) => {
  const period = (searchParams.get('period') ?? '30d') as ComparePeriod;
  const today = dateKeyIn(user.timezone);

  // Pour « depuis le debut », la periode part de la creation du compte.
  let days: number = COMPARE_PERIODS[period] ?? 30;
  if (period === 'all') {
    const first = await prisma.dailyStat.findFirst({
      where: { userId: user.id },
      orderBy: { date: 'asc' },
      select: { date: true },
    });
    days = first ? dateKeyRange(first.date, today).length : 30;
  }

  const currentRange = lastNDays(days, today);
  const previousEnd = addDaysToKey(currentRange[0], -1);
  const previousRange = lastNDays(days, previousEnd);

  const [currentSeries, previousSeries] = await Promise.all([
    readRange(user.id, currentRange),
    readRange(user.id, previousRange),
  ]);

  const currentTotals = aggregate(currentSeries);
  const previousTotals = aggregate(previousSeries);

  return ok({
    period,
    days,
    current: { from: currentRange[0], to: today, totals: currentTotals, series: currentSeries },
    previous: { from: previousRange[0], to: previousEnd, totals: previousTotals, series: previousSeries },
    metrics: buildMetrics(currentTotals, previousTotals),
    radar: {
      current: buildRadar(currentTotals, days),
      previous: buildRadar(previousTotals, days),
    },
  });
}, { rateLimit: { key: 'analytics', ...RATE_LIMITS.analytics } });
