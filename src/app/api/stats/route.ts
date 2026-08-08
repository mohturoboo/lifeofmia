import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { RATE_LIMITS } from '@/lib/auth/rate-limit';
import { ok } from '@/lib/api/response';
import { dateKeyIn, lastNDays, COMPARE_PERIODS, type ComparePeriod } from '@/lib/date';
import { aggregate, heatmap, readRange } from '@/lib/stats';
import { levelProgress } from '@/lib/gamification';
import { buildRadar } from '@/lib/analytics';

/**
 * GET /api/stats?period=7d|30d|3m|6m|1y|all
 *
 * Vue analytique complete : serie temporelle, agregats, heatmap annuelle,
 * repartition des habitudes par categorie et profil radar d'equilibre de vie.
 */
export const GET = route(async ({ user, searchParams }) => {
  const period = (searchParams.get('period') ?? '30d') as ComparePeriod;
  const days = COMPARE_PERIODS[period] ?? 30;
  const today = dateKeyIn(user.timezone);

  const range = lastNDays(days, today);
  const [series, yearHeatmap, habits, badges] = await Promise.all([
    readRange(user.id, range),
    heatmap(user.id, today, 364),
    prisma.habit.findMany({
      where: { userId: user.id, archivedAt: null },
      select: {
        id: true,
        name: true,
        category: true,
        color: true,
        logs: { where: { date: { gte: range[0] } }, select: { status: true } },
      },
    }),
    prisma.userBadge.findMany({ where: { userId: user.id }, include: { badge: true } }),
  ]);

  const totals = aggregate(series);

  // Repartition des validations par categorie d'habitude.
  const byCategory = habits.reduce<Record<string, number>>((accumulator, habit) => {
    const done = habit.logs.filter((log) => log.status === 'done').length;
    accumulator[habit.category] = (accumulator[habit.category] ?? 0) + done;
    return accumulator;
  }, {});

  const perHabit = habits
    .map((habit) => ({
      id: habit.id,
      name: habit.name,
      color: habit.color,
      done: habit.logs.filter((log) => log.status === 'done').length,
      missed: habit.logs.filter((log) => log.status !== 'done').length,
      rate: Math.round((habit.logs.filter((log) => log.status === 'done').length / Math.max(1, days)) * 100),
    }))
    .sort((a, b) => b.rate - a.rate);

  /**
   * Radar d'equilibre : chaque axe est ramene sur 0-100 par rapport a une cible
   * quotidienne raisonnable, afin que les dimensions soient comparables entre
   * elles malgre des unites tres differentes.
   */
  const radar = buildRadar(totals, days);

  return ok({
    period,
    days,
    series,
    totals,
    heatmap: yearHeatmap,
    byCategory,
    perHabit,
    radar,
    progress: levelProgress(user.xp),
    streak: { current: user.currentStreak, longest: user.longestStreak },
    badges: badges.map((entry) => ({ ...entry.badge, unlockedAt: entry.unlockedAt })),
  });
}, { rateLimit: { key: 'analytics', ...RATE_LIMITS.analytics } });
