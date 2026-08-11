import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { RATE_LIMITS } from '@/lib/auth/rate-limit';
import { ok } from '@/lib/api/response';
import { addDaysToKey, dateKeyIn, dateKeyRange, COMPARE_PERIODS, type ComparePeriod } from '@/lib/date';
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
  /*
   * Rien n'existe avant la creation du compte.
   *
   * Les deux fenetres etaient auparavant deduites du seul calendrier : sur un
   * compte de deux jours, « les 30 jours precedents » remontaient a un mois et
   * demi avant l'inscription. Ces journees sans ligne en base etaient lues
   * comme des zeros, puis comparees : la page annoncait une progression de
   * +40 % par rapport a une periode ou l'utilisateur n'avait pas de compte.
   * Une comparaison contre du vide n'est pas une comparaison.
   */
  const accountStart = dateKeyIn(user.timezone, user.createdAt);

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

  const requestedFrom = addDaysToKey(today, -(days - 1));
  const currentRange = dateKeyRange(requestedFrom < accountStart ? accountStart : requestedFrom, today);

  /*
   * La periode de reference doit tenir ENTIEREMENT dans la vie du compte et
   * durer aussi longtemps que la periode courante : comparer trente jours a
   * douze fausserait tous les cumuls. Faute de quoi il n'y a pas encore deux
   * periodes reelles, et l'interface le dit au lieu d'inventer un ecart.
   */
  const previousEnd = addDaysToKey(currentRange[0], -1);
  const previousFrom = addDaysToKey(previousEnd, -(currentRange.length - 1));
  const hasPrevious = previousFrom >= accountStart;
  const previousRange = hasPrevious ? dateKeyRange(previousFrom, previousEnd) : [];

  const [currentSeries, previousSeries] = await Promise.all([
    readRange(user.id, currentRange),
    readRange(user.id, previousRange),
  ]);

  const currentTotals = aggregate(currentSeries);
  const previousTotals = hasPrevious ? aggregate(previousSeries) : null;

  return ok({
    period,
    days: currentRange.length,
    accountStart,
    hasPrevious,
    current: { from: currentRange[0], to: today, totals: currentTotals, series: currentSeries },
    previous:
      hasPrevious && previousTotals
        ? { from: previousRange[0], to: previousEnd, totals: previousTotals, series: previousSeries }
        : null,
    metrics: hasPrevious && previousTotals ? buildMetrics(currentTotals, previousTotals) : [],
    radar: {
      current: buildRadar(currentTotals, currentRange.length),
      previous: hasPrevious && previousTotals ? buildRadar(previousTotals, previousRange.length) : null,
    },
  });
}, { rateLimit: { key: 'analytics', ...RATE_LIMITS.analytics } });
