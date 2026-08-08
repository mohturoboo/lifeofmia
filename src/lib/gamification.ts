import { prisma } from '@/lib/prisma';
import { addDaysToKey, dateKeyIn, type DateKey } from '@/lib/date';

/**
 * Moteur de gamification : XP, niveaux, series (streaks) et badges.
 *
 * La courbe de progression est volontairement quadratique douce : les premiers
 * niveaux arrivent vite (effet d'accroche) puis l'ecart se creuse, ce qui evite
 * de « terminer » l'application au bout de quelques semaines.
 *
 *   XP total requis pour atteindre le niveau L :  50 * (L-1)^2 + 50 * (L-1)
 */

export function xpForLevel(level: number): number {
  const l = Math.max(1, level) - 1;
  return 50 * l * l + 50 * l;
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp && level < 200) level += 1;
  return level;
}

export interface LevelProgress {
  level: number;
  xp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  intoLevel: number;
  neededForNext: number;
  percent: number;
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelFromXp(xp);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const intoLevel = xp - currentLevelXp;
  const span = Math.max(1, nextLevelXp - currentLevelXp);
  return {
    level,
    xp,
    currentLevelXp,
    nextLevelXp,
    intoLevel,
    neededForNext: nextLevelXp - xp,
    percent: Math.min(100, Math.round((intoLevel / span) * 100)),
  };
}

export type XpSource =
  | 'habit'
  | 'task'
  | 'goal'
  | 'workout'
  | 'prayer'
  | 'journal'
  | 'weight'
  | 'streak'
  | 'badge';

/**
 * Attribue de l'XP, met a jour le niveau et journalise l'evenement.
 * Renvoie l'ancien et le nouveau niveau pour permettre a l'UI de celebrer une
 * montee de niveau.
 */
export async function awardXp(
  userId: string,
  amount: number,
  reason: string,
  source: XpSource,
): Promise<{ xp: number; level: number; leveledUp: boolean; previousLevel: number }> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { xp: true, level: true },
  });

  const xp = Math.max(0, user.xp + amount);
  const level = levelFromXp(xp);

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { xp, level } }),
    prisma.xpEvent.create({ data: { userId, amount, reason, source } }),
  ]);

  return { xp, level, leveledUp: level > user.level, previousLevel: user.level };
}

/**
 * Recalcule la serie de jours consecutifs.
 * Un jour compte comme « actif » des qu'au moins une habitude ou une tache y a
 * ete validee — la regle est volontairement indulgente pour recompenser la
 * regularite plutot que la perfection.
 */
export async function refreshStreak(userId: string, timezone: string): Promise<number> {
  const today = dateKeyIn(timezone);
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { currentStreak: true, longestStreak: true, lastActiveDate: true },
  });

  if (user.lastActiveDate === today) return user.currentStreak;

  const yesterday = addDaysToKey(today, -1);
  const continues = user.lastActiveDate === yesterday;
  const currentStreak = continues ? user.currentStreak + 1 : 1;
  const longestStreak = Math.max(user.longestStreak, currentStreak);

  await prisma.user.update({
    where: { id: userId },
    data: { currentStreak, longestStreak, lastActiveDate: today },
  });

  // Bonus de palier : recompense les series remarquables.
  if ([7, 30, 100, 365].includes(currentStreak)) {
    await awardXp(userId, currentStreak * 2, `Serie de ${currentStreak} jours`, 'streak');
  }

  return currentStreak;
}

/**
 * Serie reellement en cours a la date du jour.
 *
 * `currentStreak` n'est mis a jour qu'a l'ecriture : un utilisateur inactif
 * depuis une semaine conservait donc l'affichage de son ancienne serie. Cette
 * fonction confronte la valeur stockee a `lastActiveDate` et renvoie 0 des que
 * la chaine est rompue — l'affichage devient honnete sans ecriture en base.
 */
export function effectiveStreak(
  user: { currentStreak: number; lastActiveDate: string | null },
  timezone: string,
): number {
  if (!user.lastActiveDate) return 0;

  const today = dateKeyIn(timezone);
  if (user.lastActiveDate === today) return user.currentStreak;
  // Une journee entamee sans activite ne rompt pas encore la serie.
  if (user.lastActiveDate === addDaysToKey(today, -1)) return user.currentStreak;
  return 0;
}

/** Definition des badges installes par le seed et evalues apres chaque action. */
export const BADGE_DEFINITIONS = [
  { code: 'first_step', name: 'Premier pas', description: 'Valider sa toute premiere habitude', icon: 'sparkles', tier: 'bronze', xpReward: 25 },
  { code: 'week_streak', name: 'Une semaine', description: '7 jours consecutifs d\'activite', icon: 'flame', tier: 'bronze', xpReward: 50 },
  { code: 'month_streak', name: 'Un mois de fer', description: '30 jours consecutifs d\'activite', icon: 'flame', tier: 'silver', xpReward: 200 },
  { code: 'century_streak', name: 'Centurion', description: '100 jours consecutifs d\'activite', icon: 'crown', tier: 'gold', xpReward: 800 },
  { code: 'year_streak', name: 'Immuable', description: '365 jours consecutifs d\'activite', icon: 'crown', tier: 'platinum', xpReward: 3000 },
  { code: 'task_master', name: 'Executant', description: 'Terminer 100 taches', icon: 'check', tier: 'silver', xpReward: 150 },
  { code: 'goal_achiever', name: 'Visionnaire', description: 'Atteindre 5 objectifs', icon: 'target', tier: 'gold', xpReward: 300 },
  { code: 'iron_body', name: 'Corps d\'acier', description: 'Enregistrer 50 seances de sport', icon: 'dumbbell', tier: 'gold', xpReward: 300 },
  { code: 'devoted', name: 'Assidu', description: '100 prieres enregistrees', icon: 'moon', tier: 'gold', xpReward: 300 },
  { code: 'scribe', name: 'Le scribe', description: '30 entrees de journal', icon: 'book', tier: 'silver', xpReward: 150 },
  { code: 'level_10', name: 'Niveau 10', description: 'Atteindre le niveau 10', icon: 'award', tier: 'silver', xpReward: 100 },
  { code: 'level_25', name: 'Niveau 25', description: 'Atteindre le niveau 25', icon: 'award', tier: 'gold', xpReward: 400 },
  { code: 'transformation', name: 'Transformation', description: 'Perdre ou gagner 5 kg vers son objectif', icon: 'trending', tier: 'gold', xpReward: 400 },
] as const;

export type BadgeCode = (typeof BADGE_DEFINITIONS)[number]['code'];

/**
 * Evalue tous les badges non encore debloques et attribue ceux qui sont acquis.
 * Renvoie les codes nouvellement obtenus (pour l'affichage d'une celebration).
 */
export async function evaluateBadges(userId: string): Promise<string[]> {
  const [user, owned, counts] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { level: true, longestStreak: true },
    }),
    prisma.userBadge.findMany({ where: { userId }, select: { badge: { select: { code: true } } } }),
    Promise.all([
      prisma.habitLog.count({ where: { userId, status: 'done' } }),
      prisma.task.count({ where: { userId, status: 'done' } }),
      prisma.goal.count({ where: { userId, status: 'done' } }),
      prisma.workout.count({ where: { userId } }),
      prisma.prayerLog.count({ where: { userId, status: { not: 'missed' } } }),
      prisma.journalEntry.count({ where: { userId } }),
    ]),
  ]);

  const [habitLogs, tasksDone, goalsDone, workouts, prayers, journals] = counts;
  const ownedCodes = new Set(owned.map((entry) => entry.badge.code));

  /*
   * Ecart de poids entre la premiere et la derniere pesee.
   * Le badge « transformation » etait defini mais jamais evalue : il figurait
   * dans la liste sans qu'aucun utilisateur puisse l'obtenir.
   */
  let weightDelta = 0;
  if (!ownedCodes.has('transformation')) {
    const [first, last] = await Promise.all([
      prisma.weightEntry.findFirst({ where: { userId }, orderBy: { date: 'asc' }, select: { weightKg: true } }),
      prisma.weightEntry.findFirst({ where: { userId }, orderBy: { date: 'desc' }, select: { weightKg: true } }),
    ]);
    if (first && last) weightDelta = last.weightKg - first.weightKg;
  }

  const achieved: Record<string, boolean> = {
    transformation: Math.abs(weightDelta) >= 5,
    first_step: habitLogs >= 1,
    week_streak: user.longestStreak >= 7,
    month_streak: user.longestStreak >= 30,
    century_streak: user.longestStreak >= 100,
    year_streak: user.longestStreak >= 365,
    task_master: tasksDone >= 100,
    goal_achiever: goalsDone >= 5,
    iron_body: workouts >= 50,
    devoted: prayers >= 100,
    scribe: journals >= 30,
    level_10: user.level >= 10,
    level_25: user.level >= 25,
  };

  const newlyUnlocked: string[] = [];
  for (const [code, isAchieved] of Object.entries(achieved)) {
    if (!isAchieved || ownedCodes.has(code)) continue;

    const badge = await prisma.badge.findUnique({ where: { code } });
    if (!badge) continue;

    await prisma.userBadge.create({ data: { userId, badgeId: badge.id } }).catch(() => undefined);
    await awardXp(userId, badge.xpReward, `Badge : ${badge.name}`, 'badge');
    newlyUnlocked.push(code);
  }

  return newlyUnlocked;
}

/**
 * Score de discipline (0-100) d'une journee.
 * Pondere les differents piliers plutot que de faire une moyenne brute :
 * les habitudes et les taches pesent le plus car ce sont les engagements que
 * l'utilisateur a explicitement pris.
 */
export function disciplineScore(input: {
  habitsDone: number;
  habitsTotal: number;
  tasksDone: number;
  tasksTotal: number;
  prayersDone: number;
  workoutMinutes: number;
  focusMinutes: number;
}): number {
  const ratio = (done: number, total: number) => (total > 0 ? Math.min(1, done / total) : 0);

  const parts: Array<[number, number]> = [
    [ratio(input.habitsDone, input.habitsTotal), input.habitsTotal > 0 ? 0.4 : 0],
    [ratio(input.tasksDone, input.tasksTotal), input.tasksTotal > 0 ? 0.25 : 0],
    [Math.min(1, input.prayersDone / 5), input.prayersDone > 0 ? 0.15 : 0],
    [Math.min(1, input.workoutMinutes / 30), 0.1],
    [Math.min(1, input.focusMinutes / 120), 0.1],
  ];

  const totalWeight = parts.reduce((sum, [, weight]) => sum + weight, 0);
  if (totalWeight === 0) return 0;

  const weighted = parts.reduce((sum, [value, weight]) => sum + value * weight, 0);
  return Math.round((weighted / totalWeight) * 100);
}

export type { DateKey };
