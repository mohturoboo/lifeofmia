import { describe, expect, it } from 'vitest';
import { disciplineScore, levelFromXp, levelProgress, xpForLevel } from '@/lib/gamification';

describe('progression de niveau', () => {
  it('demarre au niveau 1 avec 0 XP', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(levelFromXp(0)).toBe(1);
  });

  it('exige de plus en plus d\'XP a chaque palier', () => {
    const gaps = [1, 2, 3, 4, 5].map((level) => xpForLevel(level + 1) - xpForLevel(level));
    for (let index = 1; index < gaps.length; index += 1) {
      expect(gaps[index]).toBeGreaterThan(gaps[index - 1]);
    }
  });

  it('deduit le niveau exactement au seuil', () => {
    const threshold = xpForLevel(5);
    expect(levelFromXp(threshold)).toBe(5);
    expect(levelFromXp(threshold - 1)).toBe(4);
  });

  it('reste borne pour des valeurs extremes', () => {
    expect(levelFromXp(-100)).toBe(1);
    expect(levelFromXp(Number.MAX_SAFE_INTEGER)).toBeLessThanOrEqual(200);
  });

  it('calcule une progression coherente dans le niveau', () => {
    const progress = levelProgress(xpForLevel(3));
    expect(progress.level).toBe(3);
    expect(progress.intoLevel).toBe(0);
    expect(progress.percent).toBe(0);
    expect(progress.neededForNext).toBe(xpForLevel(4) - xpForLevel(3));
  });

  it('borne le pourcentage entre 0 et 100', () => {
    for (const xp of [0, 1, 500, 5000, 50000]) {
      const progress = levelProgress(xp);
      expect(progress.percent).toBeGreaterThanOrEqual(0);
      expect(progress.percent).toBeLessThanOrEqual(100);
    }
  });
});

describe('score de discipline', () => {
  const empty = {
    habitsDone: 0,
    habitsTotal: 0,
    tasksDone: 0,
    tasksTotal: 0,
    prayersDone: 0,
    workoutMinutes: 0,
    focusMinutes: 0,
  };

  it('vaut 0 pour une journee vide', () => {
    expect(disciplineScore(empty)).toBe(0);
  });

  it('vaut 100 pour une journee parfaite', () => {
    expect(
      disciplineScore({
        habitsDone: 7,
        habitsTotal: 7,
        tasksDone: 5,
        tasksTotal: 5,
        prayersDone: 5,
        workoutMinutes: 60,
        focusMinutes: 180,
      }),
    ).toBe(100);
  });

  it('reste dans l\'intervalle 0-100 meme au-dela des cibles', () => {
    const score = disciplineScore({
      habitsDone: 20,
      habitsTotal: 5,
      tasksDone: 50,
      tasksTotal: 5,
      prayersDone: 10,
      workoutMinutes: 500,
      focusMinutes: 900,
    });
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('ignore les piliers sans engagement plutot que de penaliser', () => {
    // Aucune habitude definie : le score ne doit pas etre plombe par une
    // division par zero ni par un pilier vide.
    const score = disciplineScore({ ...empty, tasksDone: 3, tasksTotal: 3 });
    expect(score).toBeGreaterThan(0);
  });

  it('donne plus de poids aux habitudes qu\'au sport', () => {
    const withHabits = disciplineScore({ ...empty, habitsDone: 5, habitsTotal: 5 });
    const withWorkout = disciplineScore({ ...empty, workoutMinutes: 60 });
    expect(withHabits).toBeGreaterThan(withWorkout);
  });
});
