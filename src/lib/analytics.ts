import type { Aggregate } from '@/lib/stats';
import type { DictionaryKey } from '@/i18n';

/**
 * Construction des indicateurs analytiques.
 *
 * Ces fonctions renvoient des **cles de traduction**, jamais du texte. L'API ne
 * connait pas la langue de l'utilisateur — elle n'a aucune raison de la
 * connaitre — et c'est l'interface qui traduit au moment de l'affichage.
 *
 * Auparavant les libelles etaient ecrits en francais directement dans les
 * routes : un utilisateur anglophone ou arabophone voyait « Score de
 * discipline » au milieu d'une interface traduite.
 */

export interface MetricDelta {
  key: string;
  /** Cle de traduction, a passer a `t()` cote client. */
  labelKey: DictionaryKey;
  unit: string;
  current: number;
  previous: number;
  delta: number;
  percent: number | null;
  /** `true` quand une valeur qui baisse est une bonne nouvelle (ex. le poids). */
  lowerIsBetter?: boolean;
}

export interface RadarAxis {
  labelKey: DictionaryKey;
  value: number;
}

/** Ramene une valeur cumulee sur une echelle 0-100 par rapport a une cible quotidienne. */
function scaleToDaily(total: number, days: number, dailyTarget: number): number {
  if (days <= 0 || dailyTarget <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((total / days) * (100 / dailyTarget))));
}

/**
 * Profil radar d'equilibre de vie.
 * Chaque axe est normalise sur 0-100 par rapport a une cible quotidienne
 * raisonnable, afin que des unites tres differentes restent comparables.
 */
export function buildRadar(totals: Aggregate, days: number): RadarAxis[] {
  return [
    { labelKey: 'axis.discipline', value: totals.avgDiscipline },
    { labelKey: 'axis.habits', value: totals.habitCompletion },
    { labelKey: 'axis.sport', value: scaleToDaily(totals.workoutMinutes, days, 30) },
    { labelKey: 'axis.focus', value: scaleToDaily(totals.focusMinutes, days, 120) },
    { labelKey: 'axis.spirituality', value: scaleToDaily(totals.prayersDone, days, 5) },
    { labelKey: 'axis.mood', value: totals.avgMood ? Math.round((totals.avgMood / 5) * 100) : 0 },
  ];
}

/** Compare deux periodes agregees, indicateur par indicateur. */
export function buildMetrics(current: Aggregate, previous: Aggregate): MetricDelta[] {
  const rows: Array<Omit<MetricDelta, 'delta' | 'percent'>> = [
    { key: 'discipline', labelKey: 'metric.discipline', unit: '%', current: current.avgDiscipline, previous: previous.avgDiscipline },
    { key: 'habits', labelKey: 'metric.habits', unit: '', current: current.habitsDone, previous: previous.habitsDone },
    { key: 'habitRate', labelKey: 'metric.habitRate', unit: '%', current: current.habitCompletion, previous: previous.habitCompletion },
    { key: 'tasks', labelKey: 'metric.tasks', unit: '', current: current.tasksDone, previous: previous.tasksDone },
    { key: 'focus', labelKey: 'metric.focus', unit: 'min', current: current.focusMinutes, previous: previous.focusMinutes },
    { key: 'workout', labelKey: 'metric.workout', unit: 'min', current: current.workoutMinutes, previous: previous.workoutMinutes },
    { key: 'reading', labelKey: 'metric.reading', unit: 'min', current: current.readingMinutes, previous: previous.readingMinutes },
    { key: 'prayers', labelKey: 'metric.prayers', unit: '', current: current.prayersDone, previous: previous.prayersDone },
    { key: 'calories', labelKey: 'metric.calories', unit: 'kcal', current: current.avgCalories, previous: previous.avgCalories },
    { key: 'protein', labelKey: 'metric.protein', unit: 'g', current: current.avgProtein, previous: previous.avgProtein },
    { key: 'water', labelKey: 'metric.water', unit: 'ml', current: current.avgWaterMl, previous: previous.avgWaterMl },
    { key: 'mood', labelKey: 'metric.mood', unit: '/5', current: current.avgMood ?? 0, previous: previous.avgMood ?? 0 },
    { key: 'xp', labelKey: 'metric.xp', unit: 'XP', current: current.xpEarned, previous: previous.xpEarned },
    { key: 'activeDays', labelKey: 'metric.activeDays', unit: 'j', current: current.activeDays, previous: previous.activeDays },
  ];

  const metrics: MetricDelta[] = rows.map((row) => ({
    ...row,
    delta: Math.round((row.current - row.previous) * 10) / 10,
    percent: row.previous > 0 ? Math.round(((row.current - row.previous) / row.previous) * 1000) / 10 : null,
  }));

  // Le poids n'apparait que si les deux periodes contiennent une pesee, sans
  // quoi la comparaison porterait sur un zero arbitraire.
  if (current.weightEnd !== null && previous.weightEnd !== null) {
    metrics.push({
      key: 'weight',
      labelKey: 'metric.weight',
      unit: 'kg',
      current: current.weightEnd,
      previous: previous.weightEnd,
      delta: Math.round((current.weightEnd - previous.weightEnd) * 10) / 10,
      percent: null,
      lowerIsBetter: true,
    });
  }

  return metrics;
}
