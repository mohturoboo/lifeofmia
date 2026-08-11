import { prisma } from '@/lib/prisma';
import { disciplineScore } from '@/lib/levels';
import { dateKeyIn, lastNDays, weekDayOf, type DateKey } from '@/lib/date';
import { parseNumberArray } from '@/lib/json';

/**
 * Agregation statistique.
 *
 * Le principe : `recomputeDay()` recalcule l'instantane d'une journee et le
 * persiste dans `DailyStat`. Toutes les lectures analytiques (dashboard,
 * statistiques, comparaison) tapent ensuite cette table unique, ce qui rend les
 * pages rapides meme sur plusieurs annees d'historique.
 */

export interface DayStats {
  date: DateKey;
  habitsDone: number;
  habitsTotal: number;
  tasksDone: number;
  tasksTotal: number;
  prayersDone: number;
  calories: number;
  proteinG: number;
  waterMl: number;
  weightKg: number | null;
  workoutMinutes: number;
  focusMinutes: number;
  readingMinutes: number;
  mood: number | null;
  xpEarned: number;
  disciplineScore: number;
  completionRate: number;
}

/** Une habitude est-elle attendue ce jour-la, d'apres sa frequence ? */
export function isHabitScheduled(weekDaysJson: string, frequency: string, date: DateKey): boolean {
  if (frequency === 'weekly') return true;
  const days = parseNumberArray(weekDaysJson);
  if (days.length === 0) return true;
  return days.includes(weekDayOf(date));
}

export interface HabitWindow {
  createdAt: Date;
  archivedAt: Date | null;
  weekDays: string;
  frequency: string;
}

/**
 * Une habitude compte-t-elle dans le denominateur de cette journee ?
 *
 * La frequence ne suffit pas : il faut aussi que l'habitude ait EXISTE ce
 * jour-la. Sans cette condition, le denominateur d'une journee etait toujours
 * calcule avec la liste d'habitudes du moment, et une action presente
 * reecrivait le passe. Enregistrer un repas d'avant-hier suffisait a
 * declencher le recalcul de cette journee-la : une habitude creee depuis
 * s'ajoutait a son total attendu, jamais validee puisqu'elle n'existait pas,
 * et le score d'avant-hier baissait tout seul. Le meme mecanisme jouait a
 * l'envers a l'archivage — l'habitude disparaissait de toutes les journees
 * passees, dont celles ou elle avait ete validee.
 *
 * La fenetre d'existence va de la creation (incluse) au jour precedant
 * l'archivage. Le jour de l'archivage lui-meme est exclu, pour rester aligne
 * sur la liste d'habitudes que le tableau de bord affiche le jour meme : deux
 * denominateurs differents pour la meme journee sont precisement le genre
 * d'incoherence que cette fonction existe pour supprimer. Les journees
 * ANTERIEURES, elles, ne bougent pas — c'est tout l'objet du bornage.
 */
export function habitCountsOn(habit: HabitWindow, date: DateKey, timezone: string): boolean {
  if (dateKeyIn(timezone, habit.createdAt) > date) return false;
  if (habit.archivedAt && dateKeyIn(timezone, habit.archivedAt) <= date) return false;
  return isHabitScheduled(habit.weekDays, habit.frequency, date);
}

/**
 * Recalcule et persiste les statistiques d'une journee.
 * Appelee apres chaque ecriture significative (habitude, tache, repas, poids...).
 */
export async function recomputeDay(userId: string, date: DateKey): Promise<DayStats> {
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(`${date}T23:59:59.999Z`);

  const [owner, habits, habitLogs, tasks, prayerLogs, meals, water, weight, workouts, focus, journal, xpEvents] =
    await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } }),
      /*
       * Les habitudes archivees sont chargees elles aussi : c'est
       * `habitCountsOn` qui decide, journee par journee, si l'habitude existait
       * alors. Les filtrer ici revenait a effacer d'un coup leur presence dans
       * tout l'historique.
       */
      prisma.habit.findMany({
        where: { userId },
        select: {
          id: true,
          weekDays: true,
          frequency: true,
          targetPerDay: true,
          isNegative: true,
          createdAt: true,
          archivedAt: true,
        },
      }),
      prisma.habitLog.findMany({ where: { userId, date }, select: { habitId: true, status: true, count: true } }),
      prisma.task.findMany({
        where: {
          userId,
          OR: [
            { dueDate: { gte: dayStart, lte: dayEnd } },
            { completedAt: { gte: dayStart, lte: dayEnd } },
          ],
        },
        select: { status: true },
      }),
      prisma.prayerLog.count({ where: { userId, date, status: { not: 'missed' } } }),
      prisma.meal.aggregate({ where: { userId, date }, _sum: { calories: true, protein: true } }),
      prisma.waterLog.aggregate({ where: { userId, date }, _sum: { amountMl: true } }),
      prisma.weightEntry.findFirst({ where: { userId, date }, select: { weightKg: true } }),
      prisma.workout.aggregate({ where: { userId, date }, _sum: { durationMin: true } }),
      prisma.focusSession.findMany({ where: { userId, date }, select: { minutes: true, label: true } }),
      prisma.journalEntry.findFirst({ where: { userId, date }, select: { mood: true } }),
      prisma.xpEvent.aggregate({
        where: { userId, createdAt: { gte: dayStart, lte: dayEnd } },
        _sum: { amount: true },
      }),
    ]);

  const timezone = owner?.timezone ?? 'UTC';
  const scheduled = habits.filter((habit) => habitCountsOn(habit, date, timezone));
  const logsByHabit = new Map(habitLogs.map((log) => [log.habitId, log]));

  const habitsDone = scheduled.filter((habit) => {
    const log = logsByHabit.get(habit.id);
    if (!log) return false;
    // Une habitude negative est « reussie » quand elle est explicitement evitee.
    if (habit.isNegative) return log.status === 'done';
    return log.status === 'done' && log.count >= habit.targetPerDay;
  }).length;

  const tasksTotal = tasks.length;
  const tasksDone = tasks.filter((task) => task.status === 'done').length;
  const focusMinutes = focus.reduce((sum, session) => sum + session.minutes, 0);
  const readingMinutes = focus
    .filter((session) => /lect|read|livre|book/i.test(session.label ?? ''))
    .reduce((sum, session) => sum + session.minutes, 0);
  const workoutMinutes = workouts._sum.durationMin ?? 0;

  const score = disciplineScore({
    habitsDone,
    habitsTotal: scheduled.length,
    tasksDone,
    tasksTotal,
    prayersDone: prayerLogs,
    workoutMinutes,
    focusMinutes,
  });

  const completionRate =
    scheduled.length + tasksTotal > 0
      ? Math.round(((habitsDone + tasksDone) / (scheduled.length + tasksTotal)) * 100)
      : 0;

  const stats: DayStats = {
    date,
    habitsDone,
    habitsTotal: scheduled.length,
    tasksDone,
    tasksTotal,
    prayersDone: prayerLogs,
    calories: Math.round(meals._sum.calories ?? 0),
    proteinG: Math.round(meals._sum.protein ?? 0),
    waterMl: water._sum.amountMl ?? 0,
    weightKg: weight?.weightKg ?? null,
    workoutMinutes,
    focusMinutes,
    readingMinutes,
    mood: journal?.mood ?? null,
    xpEarned: xpEvents._sum.amount ?? 0,
    disciplineScore: score,
    completionRate,
  };

  await prisma.dailyStat.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, ...stats },
    update: stats,
  });

  return stats;
}

/** Lit une plage de journees, en comblant les jours sans donnee. */
export async function readRange(userId: string, dates: DateKey[]): Promise<DayStats[]> {
  if (dates.length === 0) return [];

  const rows = await prisma.dailyStat.findMany({
    where: { userId, date: { gte: dates[0], lte: dates[dates.length - 1] } },
    orderBy: { date: 'asc' },
  });
  const byDate = new Map(rows.map((row) => [row.date, row]));

  return dates.map((date) => {
    const row = byDate.get(date);
    if (!row) {
      return {
        date,
        habitsDone: 0,
        habitsTotal: 0,
        tasksDone: 0,
        tasksTotal: 0,
        prayersDone: 0,
        calories: 0,
        proteinG: 0,
        waterMl: 0,
        weightKg: null,
        workoutMinutes: 0,
        focusMinutes: 0,
        readingMinutes: 0,
        mood: null,
        xpEarned: 0,
        disciplineScore: 0,
        completionRate: 0,
      } satisfies DayStats;
    }
    return {
      date: row.date,
      habitsDone: row.habitsDone,
      habitsTotal: row.habitsTotal,
      tasksDone: row.tasksDone,
      tasksTotal: row.tasksTotal,
      prayersDone: row.prayersDone,
      calories: row.calories,
      proteinG: row.proteinG,
      waterMl: row.waterMl,
      weightKg: row.weightKg,
      workoutMinutes: row.workoutMinutes,
      focusMinutes: row.focusMinutes,
      readingMinutes: row.readingMinutes,
      mood: row.mood,
      xpEarned: row.xpEarned,
      disciplineScore: row.disciplineScore,
      completionRate: row.completionRate,
    } satisfies DayStats;
  });
}

/**
 * Une journee compte comme active des qu'elle porte une trace d'usage.
 *
 * Le decompte ne regardait que les habitudes et les taches : une journee ou
 * l'utilisateur avait fait ses cinq prieres, enregistre ses repas, bu deux
 * litres, fait une heure de sport et ecrit dans son journal etait comptee
 * comme inactive. Les statistiques affichaient « 0 jour actif » a quelqu'un
 * qui venait de renseigner sa journee entiere.
 */
export function isActiveDay(day: DayStats): boolean {
  return (
    day.habitsDone > 0 ||
    day.tasksDone > 0 ||
    day.prayersDone > 0 ||
    day.calories > 0 ||
    day.waterMl > 0 ||
    day.workoutMinutes > 0 ||
    day.focusMinutes > 0 ||
    day.readingMinutes > 0 ||
    day.weightKg !== null ||
    day.mood !== null
  );
}

export interface Aggregate {
  days: number;
  activeDays: number;
  habitsDone: number;
  habitCompletion: number;
  tasksDone: number;
  prayersDone: number;
  avgCalories: number;
  avgProtein: number;
  avgWaterMl: number;
  workoutMinutes: number;
  focusMinutes: number;
  readingMinutes: number;
  avgMood: number | null;
  xpEarned: number;
  avgDiscipline: number;
  avgCompletion: number;
  weightStart: number | null;
  weightEnd: number | null;
  weightDelta: number | null;
}

/** Resume une plage de journees en un jeu d'indicateurs comparables. */
export function aggregate(days: DayStats[]): Aggregate {
  const count = Math.max(1, days.length);
  const sum = (pick: (day: DayStats) => number) => days.reduce((acc, day) => acc + pick(day), 0);

  const withMood = days.filter((day) => day.mood !== null);
  const weights = days.filter((day) => day.weightKg !== null);
  const weightStart = weights[0]?.weightKg ?? null;
  const weightEnd = weights[weights.length - 1]?.weightKg ?? null;

  const habitsTotal = sum((day) => day.habitsTotal);
  const habitsDone = sum((day) => day.habitsDone);

  return {
    days: days.length,
    activeDays: days.filter(isActiveDay).length,
    habitsDone,
    habitCompletion: habitsTotal > 0 ? Math.round((habitsDone / habitsTotal) * 100) : 0,
    tasksDone: sum((day) => day.tasksDone),
    prayersDone: sum((day) => day.prayersDone),
    avgCalories: Math.round(sum((day) => day.calories) / count),
    avgProtein: Math.round(sum((day) => day.proteinG) / count),
    avgWaterMl: Math.round(sum((day) => day.waterMl) / count),
    workoutMinutes: sum((day) => day.workoutMinutes),
    focusMinutes: sum((day) => day.focusMinutes),
    readingMinutes: sum((day) => day.readingMinutes),
    avgMood:
      withMood.length > 0
        ? Math.round((withMood.reduce((acc, day) => acc + (day.mood ?? 0), 0) / withMood.length) * 10) / 10
        : null,
    xpEarned: sum((day) => day.xpEarned),
    avgDiscipline: Math.round(sum((day) => day.disciplineScore) / count),
    avgCompletion: Math.round(sum((day) => day.completionRate) / count),
    weightStart,
    weightEnd,
    weightDelta:
      weightStart !== null && weightEnd !== null
        ? Math.round((weightEnd - weightStart) * 10) / 10
        : null,
  };
}

/**
 * Regression lineaire simple sur l'historique de poids, utilisee pour projeter
 * la tendance a N jours. Renvoie `null` si l'historique est insuffisant.
 */
export function projectWeight(
  entries: Array<{ date: DateKey; weightKg: number }>,
  daysAhead: number,
): { predicted: number; slopePerWeek: number } | null {
  if (entries.length < 3) return null;

  const base = new Date(`${entries[0].date}T12:00:00Z`).getTime();
  const points = entries.map((entry) => ({
    x: (new Date(`${entry.date}T12:00:00Z`).getTime() - base) / 86_400_000,
    y: entry.weightKg,
  }));

  const n = points.length;
  const sumX = points.reduce((acc, point) => acc + point.x, 0);
  const sumY = points.reduce((acc, point) => acc + point.y, 0);
  const sumXY = points.reduce((acc, point) => acc + point.x * point.y, 0);
  const sumXX = points.reduce((acc, point) => acc + point.x * point.x, 0);

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  const lastX = points[points.length - 1].x;

  return {
    predicted: Math.round((slope * (lastX + daysAhead) + intercept) * 10) / 10,
    slopePerWeek: Math.round(slope * 7 * 100) / 100,
  };
}

/** Indice de masse corporelle. */
export function bmi(weightKg: number, heightCm: number): number | null {
  if (!heightCm || heightCm <= 0) return null;
  const meters = heightCm / 100;
  return Math.round((weightKg / (meters * meters)) * 10) / 10;
}

export function bmiCategory(value: number): 'underweight' | 'normal' | 'overweight' | 'obese' {
  if (value < 18.5) return 'underweight';
  if (value < 25) return 'normal';
  if (value < 30) return 'overweight';
  return 'obese';
}

/** Donnees de la heatmap annuelle (style « contributions »). */
export async function heatmap(userId: string, endDate: DateKey, days = 364) {
  const dates = lastNDays(days, endDate);
  const stats = await readRange(userId, dates);
  return stats.map((day) => ({ date: day.date, value: day.disciplineScore }));
}
