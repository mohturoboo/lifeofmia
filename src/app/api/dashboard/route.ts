import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { dateKeyIn, formatTimeIn, lastNDays, weekDayOf } from '@/lib/date';
import { readRange, recomputeDay } from '@/lib/stats';
import { effectiveStreak, levelProgress } from '@/lib/gamification';
import { fetchPrayerTimes, currentAndNext } from '@/lib/prayer';
import { fetchWeather } from '@/lib/weather';
import { quoteOfTheDay } from '@/lib/quotes';
import { parseNumberArray } from '@/lib/json';
import { resolveLocale } from '@/i18n/config';

/**
 * GET /api/dashboard
 *
 * Point d'entree unique du tableau de bord : une seule requete HTTP renvoie
 * tout ce que la page affiche. Les appels externes (meteo, horaires de priere)
 * sont lances en parallele et n'ont jamais le droit de faire echouer la
 * reponse — un `catch` les neutralise individuellement.
 */
export const GET = route(async ({ user }) => {
  const today = dateKeyIn(user.timezone);
  const now = new Date();
  const locale = resolveLocale(user.locale);

  const latitude = user.latitude ?? 48.8566;
  const longitude = user.longitude ?? 2.3522;

  const [stats, habits, habitLogs, tasks, weekStats, prayerSettings, prayerLogs, weather, prayerTimes, activeGoal, badgeCount] =
    await Promise.all([
      recomputeDay(user.id, today),
      prisma.habit.findMany({
        where: { userId: user.id, archivedAt: null },
        orderBy: { position: 'asc' },
        select: {
          id: true, name: true, icon: true, color: true, category: true,
          targetPerDay: true, unit: true, weekDays: true, frequency: true,
          isNegative: true, xpReward: true,
        },
      }),
      prisma.habitLog.findMany({ where: { userId: user.id, date: today } }),
      prisma.task.findMany({
        where: { userId: user.id, status: { in: ['todo', 'doing'] } },
        orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
        take: 6,
        select: { id: true, title: true, priority: true, dueDate: true, status: true },
      }),
      readRange(user.id, lastNDays(7, today)),
      prisma.prayerSettings.findUnique({ where: { userId: user.id } }),
      prisma.prayerLog.findMany({ where: { userId: user.id, date: today } }),
      fetchWeather(latitude, longitude, user.timezone).catch(() => null),
      fetchPrayerTimes({
        date: today,
        latitude,
        longitude,
        timezone: user.timezone,
        method: 3,
        school: 0,
      }).catch(() => null),
      prisma.goal.findFirst({
        where: { userId: user.id, status: 'active' },
        orderBy: [{ priority: 'desc' }, { deadline: 'asc' }],
        select: { id: true, title: true, progress: true, deadline: true, color: true },
      }),
      prisma.userBadge.count({ where: { userId: user.id } }),
    ]);

  const weekday = weekDayOf(today);
  const scheduledHabits = habits.filter((habit) => {
    if (habit.frequency === 'weekly') return true;
    const days = parseNumberArray(habit.weekDays);
    return days.length === 0 || days.includes(weekday);
  });

  const logByHabit = new Map(habitLogs.map((log) => [log.habitId, log]));

  const localTime = formatTimeIn(user.timezone, user.timeFormat as '12h' | '24h', now);
  const nextPrayer = prayerTimes ? currentAndNext(prayerTimes.times, formatTimeIn(user.timezone, '24h', now)) : null;

  const userStreak = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { lastActiveDate: true },
  });

  // Derniere pesee connue, meme si elle date de plusieurs jours.
  const lastWeight = await prisma.weightEntry.findFirst({
    where: { userId: user.id },
    orderBy: { date: 'desc' },
    select: { weightKg: true, date: true },
  });

  return ok({
    today,
    localTime,
    localDate: now.toISOString(),
    user: {
      firstName: user.firstName,
      city: user.city,
      country: user.country,
      timezone: user.timezone,
      mainGoal: user.mainGoal,
      // Serie recalculee a la lecture : une serie rompue ne doit pas rester
      // affichee tant que l'utilisateur n'a rien valide.
      currentStreak: effectiveStreak(
        { currentStreak: user.currentStreak, lastActiveDate: userStreak.lastActiveDate },
        user.timezone,
      ),
      longestStreak: user.longestStreak,
    },
    progress: levelProgress(user.xp),
    badgeCount,
    stats,
    week: weekStats,
    habits: scheduledHabits.map((habit) => {
      const log = logByHabit.get(habit.id);
      return {
        id: habit.id,
        name: habit.name,
        icon: habit.icon,
        color: habit.color,
        category: habit.category,
        unit: habit.unit,
        targetPerDay: habit.targetPerDay,
        isNegative: habit.isNegative,
        xpReward: habit.xpReward,
        count: log?.count ?? 0,
        done: log?.status === 'done' && (log?.count ?? 0) >= habit.targetPerDay,
      };
    }),
    tasks,
    goal: activeGoal,
    weight: lastWeight,
    weather,
    prayers: prayerTimes
      ? {
          times: prayerTimes.times,
          source: prayerTimes.source,
          next: nextPrayer?.next ?? null,
          minutesToNext: nextPrayer?.minutesToNext ?? null,
          logged: prayerLogs.map((log) => ({ name: log.name, status: log.status })),
          method: prayerSettings?.method ?? 3,
        }
      : null,
    quote: quoteOfTheDay(today, locale, user.id),
  });
});
