'use client';

import { useState } from 'react';
import { useResource } from '@/lib/client/api';
import { Card, CardHeader, Progress, Skeleton, cx } from '@/components/ui/primitives';
import { Icon, type IconName } from '@/components/ui/icons';
import { BarChart, DonutChart, Heatmap, LineChart, RadarChart, RingProgress } from '@/components/charts';
import { PageHeader } from '@/components/page-header';
import { useI18n } from '@/i18n/provider';
import type { Aggregate, DayStats } from '@/lib/stats';
import type { LevelProgress } from '@/lib/gamification';
import type { RadarAxis } from '@/lib/analytics';

interface StatsData {
  period: string;
  days: number;
  series: DayStats[];
  totals: Aggregate;
  heatmap: Array<{ date: string; value: number }>;
  byCategory: Record<string, number>;
  perHabit: Array<{ id: string; name: string; color: string; done: number; missed: number; rate: number }>;
  radar: RadarAxis[];
  progress: LevelProgress;
  streak: { current: number; longest: number };
  badges: Array<{ code: string; name: string; description: string; tier: string; unlockedAt: string }>;
}

const PERIODS = ['7d', '30d', '3m', '6m', '1y'] as const;

const TIER_COLORS: Record<string, string> = {
  bronze: '#b8834f',
  silver: '#97a8ad',
  gold: '#d99a63',
  platinum: '#9aa5bd',
};

export default function StatsPage() {
  const { t, locale, n } = useI18n();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>('30d');
  const { data, loading } = useResource<StatsData>(`/api/stats?period=${period}`, [period]);

  const periodLabels: Record<string, string> = {
    '7d': t('compare.since7d'),
    '30d': t('compare.since30d'),
    '3m': t('compare.since3m'),
    '6m': t('compare.since6m'),
    '1y': t('compare.since1y'),
  };

  if (loading || !data) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Skeleton className="h-24 rounded-2xl" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  const { totals } = data;

  const tiles: Array<{ label: string; value: string; icon: IconName; color: string }> = [
    { label: t('stats.avgDiscipline'), value: `${totals.avgDiscipline}%`, icon: 'shield', color: '#e9a76b' },
    { label: t('habits.completion'), value: `${totals.habitCompletion}%`, icon: 'flame', color: '#6e93a8' },
    { label: t('stats.activeDays'), value: `${totals.activeDays}/${totals.days}`, icon: 'calendar', color: '#5f9aa6' },
    { label: t('dash.tasksDone'), value: n(totals.tasksDone), icon: 'checkCircle', color: '#7ba083' },
    { label: t('sport.totalTime'), value: `${Math.round(totals.workoutMinutes / 60)} h`, icon: 'dumbbell', color: '#c97f63' },
    { label: t('dash.focusTime'), value: `${Math.round(totals.focusMinutes / 60)} h`, icon: 'clock', color: '#8592ad' },
    { label: t('prayers.title'), value: n(totals.prayersDone), icon: 'moon', color: '#5e9c9b' },
    { label: t('dash.xp'), value: n(totals.xpEarned), icon: 'award', color: '#d99a63' },
  ];

  const chartLabel = (date: string) =>
    new Date(`${date}T12:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short' });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={t('stats.title')}
        subtitle={t('stats.subtitle')}
        icon="chart"
        color="#5f9aa6"
        actions={
          <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
            {PERIODS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setPeriod(value)}
                aria-pressed={period === value}
                className={cx(
                  'rounded-lg px-3 py-1.5 text-[13px] transition-colors',
                  period === value
                    ? 'bg-[var(--surface-2)] font-medium text-[var(--text)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]',
                )}
              >
                {periodLabels[value]}
              </button>
            ))}
          </div>
        }
      />

      <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <span
              className="grid size-8 place-items-center rounded-lg"
              style={{ background: `${tile.color}1f`, color: tile.color }}
            >
              <Icon name={tile.icon} size={16} />
            </span>
            <p className="mt-2.5 text-xl font-semibold text-[var(--text)]">{tile.value}</p>
            <p className="text-[11px] leading-tight text-[var(--text-faint)]">{tile.label}</p>
          </Card>
        ))}
      </section>

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={t('dash.disciplineScore')} subtitle={periodLabels[period]} icon="trending" accent="#e9a76b" />
          <LineChart
            data={data.series.map((day) => ({ label: chartLabel(day.date), value: day.disciplineScore }))}
            color="#e9a76b"
            unit="%"
            height={220}
          />
        </Card>

        <Card>
          <CardHeader title={t('stats.radar')} icon="compare" accent="#8592ad" />
          <RadarChart
            data={data.radar.map((axis) => ({ label: t(axis.labelKey), value: axis.value }))}
            size={240}
            color="#8592ad"
          />
        </Card>
      </div>

      <Card className="mb-4">
        <CardHeader title={t('stats.heatmap')} subtitle="Un carre par jour, plus il est vif plus la journee a ete disciplinee" icon="calendar" accent="#e9a76b" />
        <Heatmap data={data.heatmap} color="#e9a76b" />
      </Card>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('stats.byCategory')} icon="chart" accent="#6e93a8" />
          {Object.keys(data.byCategory).length === 0 ? (
            <p className="py-8 text-center text-xs text-[var(--text-faint)]">{t('common.empty')}</p>
          ) : (
            <DonutChart
              data={Object.entries(data.byCategory).map(([category, value]) => ({
                label: t(`habits.category${category.charAt(0).toUpperCase()}${category.slice(1)}` as 'habits.categoryOther'),
                value,
              }))}
              size={160}
              thickness={20}
            />
          )}
        </Card>

        <Card>
          <CardHeader title={t('habits.title')} subtitle={t('habits.completion')} icon="flame" accent="#6e93a8" />
          {data.perHabit.length === 0 ? (
            <p className="py-8 text-center text-xs text-[var(--text-faint)]">{t('habits.empty')}</p>
          ) : (
            <ul className="space-y-2.5">
              {data.perHabit.slice(0, 8).map((habit) => (
                <li key={habit.id}>
                  <div className="mb-1 flex items-center justify-between text-[13px]">
                    <span className="truncate text-[var(--text-muted)]">{habit.name}</span>
                    <span className="ms-2 shrink-0 font-medium text-[var(--text)]">{habit.rate}%</span>
                  </div>
                  <Progress value={habit.rate} color={habit.color} height={6} label={habit.name} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title={t('dash.level')} icon="award" accent="#8592ad" />
          <div className="flex items-center gap-5">
            <RingProgress value={data.progress.percent} size={100} color="#8592ad" sublabel={`Niv. ${data.progress.level}`} />
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-6">
                <dt className="text-[var(--text-muted)]">{t('dash.xp')}</dt>
                <dd className="font-medium text-[var(--text)]">{n(data.progress.xp)}</dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt className="text-[var(--text-muted)]">{t('dash.streak')}</dt>
                <dd className="font-medium text-[var(--text)]">{data.streak.current} j</dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt className="text-[var(--text-muted)]">{t('stats.bestStreak')}</dt>
                <dd className="font-medium text-[var(--text)]">{data.streak.longest} j</dd>
              </div>
            </dl>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title={t('dash.badges')} subtitle={`${data.badges.length} debloques`} icon="crown" accent="#d99a63" />
          {data.badges.length === 0 ? (
            <p className="py-8 text-center text-xs text-[var(--text-faint)]">
              Validez vos premieres habitudes pour debloquer des badges.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.badges.map((badge) => (
                <div
                  key={badge.code}
                  title={badge.description}
                  className="flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2"
                >
                  <span
                    className="grid size-7 place-items-center rounded-lg"
                    style={{ background: `${TIER_COLORS[badge.tier]}22`, color: TIER_COLORS[badge.tier] }}
                  >
                    <Icon name="award" size={14} />
                  </span>
                  <div>
                    <p className="text-[13px] text-[var(--text)]">{badge.name}</p>
                    <p className="text-[10px] text-[var(--text-faint)]">
                      {new Date(badge.unlockedAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title={t('nutrition.title')} subtitle={periodLabels[period]} icon="apple" accent="#d99a63" />
        <BarChart
          data={data.series.slice(-30).map((day) => ({ label: day.date.slice(8), value: day.calories }))}
          color="#d99a63"
          unit=" kcal"
          height={140}
        />
      </Card>
    </div>
  );
}
