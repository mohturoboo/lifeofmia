/**
 * Calculs purs de gamification : courbe de niveaux et score de discipline.
 *
 * Ce module est volontairement sans dependance : la barre de progression et les
 * pages de statistiques sont rendues cote client, et importer `lib/gamification`
 * — qui parle a la base — embarquait Prisma dans le bundle du navigateur.
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
