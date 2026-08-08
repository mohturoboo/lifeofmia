import { describe, expect, it } from 'vitest';
import { aggregate, bmi, bmiCategory, projectWeight, type DayStats } from '@/lib/stats';

function day(overrides: Partial<DayStats> = {}): DayStats {
  return {
    date: '2026-08-01',
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
    ...overrides,
  };
}

describe('agregation', () => {
  it('gere une plage vide sans diviser par zero', () => {
    const totals = aggregate([]);
    expect(totals.days).toBe(0);
    expect(totals.avgDiscipline).toBe(0);
    expect(totals.avgMood).toBeNull();
    expect(totals.weightDelta).toBeNull();
  });

  it('additionne les totaux et moyenne les indicateurs', () => {
    const totals = aggregate([
      day({ date: '2026-08-01', habitsDone: 3, habitsTotal: 5, disciplineScore: 60, calories: 2000 }),
      day({ date: '2026-08-02', habitsDone: 5, habitsTotal: 5, disciplineScore: 100, calories: 2400 }),
    ]);

    expect(totals.days).toBe(2);
    expect(totals.habitsDone).toBe(8);
    expect(totals.habitCompletion).toBe(80); // 8 sur 10
    expect(totals.avgDiscipline).toBe(80);
    expect(totals.avgCalories).toBe(2200);
  });

  it('compte les jours actifs sur habitudes OU taches', () => {
    const totals = aggregate([
      day({ habitsDone: 1 }),
      day({ tasksDone: 2 }),
      day(), // inactif
    ]);
    expect(totals.activeDays).toBe(2);
  });

  it('calcule la variation de poids entre la premiere et la derniere mesure', () => {
    const totals = aggregate([
      day({ date: '2026-08-01', weightKg: 85 }),
      day({ date: '2026-08-02' }), // sans pesee
      day({ date: '2026-08-03', weightKg: 83.5 }),
    ]);

    expect(totals.weightStart).toBe(85);
    expect(totals.weightEnd).toBe(83.5);
    expect(totals.weightDelta).toBe(-1.5);
  });

  it('ignore les jours sans humeur dans la moyenne', () => {
    const totals = aggregate([day({ mood: 4 }), day({ mood: null }), day({ mood: 2 })]);
    expect(totals.avgMood).toBe(3);
  });
});

describe('projection de poids', () => {
  it('renvoie null en dessous de trois mesures', () => {
    expect(projectWeight([{ date: '2026-08-01', weightKg: 85 }], 30)).toBeNull();
    expect(
      projectWeight(
        [
          { date: '2026-08-01', weightKg: 85 },
          { date: '2026-08-02', weightKg: 84 },
        ],
        30,
      ),
    ).toBeNull();
  });

  it('extrapole une tendance lineaire descendante', () => {
    const result = projectWeight(
      [
        { date: '2026-08-01', weightKg: 90 },
        { date: '2026-08-08', weightKg: 89 },
        { date: '2026-08-15', weightKg: 88 },
        { date: '2026-08-22', weightKg: 87 },
      ],
      30,
    );

    expect(result).not.toBeNull();
    expect(result!.slopePerWeek).toBeCloseTo(-1, 1);
    // Un mois de plus au meme rythme : environ 4 kg de moins.
    expect(result!.predicted).toBeCloseTo(82.7, 0);
  });

  it('detecte une tendance stable', () => {
    const result = projectWeight(
      [
        { date: '2026-08-01', weightKg: 80 },
        { date: '2026-08-08', weightKg: 80 },
        { date: '2026-08-15', weightKg: 80 },
      ],
      30,
    );
    expect(result!.slopePerWeek).toBe(0);
    expect(result!.predicted).toBe(80);
  });
});

describe('IMC', () => {
  it('calcule et classe correctement', () => {
    expect(bmi(70, 175)).toBe(22.9);
    expect(bmiCategory(22.9)).toBe('normal');
    expect(bmiCategory(17)).toBe('underweight');
    expect(bmiCategory(27)).toBe('overweight');
    expect(bmiCategory(33)).toBe('obese');
  });

  it('renvoie null sans taille valide', () => {
    expect(bmi(70, 0)).toBeNull();
  });

  it('place les valeurs limites dans la bonne categorie', () => {
    expect(bmiCategory(18.5)).toBe('normal');
    expect(bmiCategory(25)).toBe('overweight');
    expect(bmiCategory(30)).toBe('obese');
  });
});
