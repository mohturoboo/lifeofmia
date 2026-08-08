'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { api, useResource } from '@/lib/client/api';
import { Badge, Button, Card, CardHeader, EmptyState, Progress, Skeleton, cx } from '@/components/ui/primitives';
import { Icon, type IconName } from '@/components/ui/icons';
import { BarChart, RingProgress, Sparkline } from '@/components/charts';
import { useI18n } from '@/i18n/provider';
import { formatFullDate } from '@/i18n';
import type { DayStats } from '@/lib/stats';
import type { LevelProgress } from '@/lib/gamification';

/**
 * Tableau de bord — vue unique de la journee.
 *
 * Toutes les donnees proviennent d'un seul appel a `/api/dashboard`, ce qui
 * evite la cascade de requetes typique de ce genre de page et garantit que les
 * chiffres affiches sont coherents entre eux.
 */

interface DashboardData {
  today: string;
  localTime: string;
  localDate: string;
  user: {
    firstName: string;
    city: string;
    country: string;
    timezone: string;
    mainGoal: string | null;
    currentStreak: number;
    longestStreak: number;
  };
  progress: LevelProgress;
  badgeCount: number;
  stats: DayStats;
  week: DayStats[];
  habits: Array<{
    id: string;
    name: string;
    icon: string;
    color: string;
    unit: string | null;
    targetPerDay: number;
    isNegative: boolean;
    xpReward: number;
    count: number;
    done: boolean;
  }>;
  tasks: Array<{ id: string; title: string; priority: string; dueDate: string | null }>;
  goal: { id: string; title: string; progress: number; deadline: string | null; color: string } | null;
  weight: { weightKg: number; date: string } | null;
  weather: {
    temperature: number;
    condition: string;
    icon: string;
    humidity: number;
    windKph: number;
    sunrise: string | null;
    sunset: string | null;
  } | null;
  prayers: {
    times: Record<string, string>;
    source: string;
    next: string | null;
    minutesToNext: number | null;
    logged: Array<{ name: string; status: string }>;
  } | null;
  quote: { text: string; author: string };
}

const WEATHER_ICONS: Record<string, IconName> = {
  clear: 'sun',
  partly: 'cloud',
  cloudy: 'cloud',
  rain: 'droplet',
  drizzle: 'droplet',
  snow: 'cloud',
  storm: 'zap',
  fog: 'cloud',
  unavailable: 'cloud',
};

export default function DashboardPage() {
  const { t, locale, n } = useI18n();
  const { data, loading, refresh, setData } = useResource<DashboardData>('/api/dashboard');

  const greetingKey = useMemo(() => {
    const hour = data ? new Date(data.localDate).getHours() : new Date().getHours();
    if (hour < 12) return 'dash.greetingMorning' as const;
    if (hour < 18) return 'dash.greetingAfternoon' as const;
    return 'dash.greetingEvening' as const;
  }, [data]);

  /**
   * Bascule d'une habitude avec mise a jour optimiste : la case se coche
   * immediatement, puis on resynchronise depuis le serveur.
   */
  async function toggleHabit(habitId: string, done: boolean) {
    if (!data) return;

    setData({
      ...data,
      habits: data.habits.map((habit) =>
        habit.id === habitId ? { ...habit, done: !done, count: done ? 0 : habit.targetPerDay } : habit,
      ),
    });

    try {
      await api.post(`/api/habits/${habitId}/log`, {
        date: data.today,
        count: done ? 0 : undefined,
        status: done ? 'skipped' : 'done',
      });
    } finally {
      void refresh();
    }
  }

  if (loading || !data) {
    return (
      <div className="mx-auto max-w-7xl space-y-4">
        <Skeleton className="h-28 rounded-3xl" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  const { stats, week } = data;
  const habitsDone = data.habits.filter((habit) => habit.done).length;

  const tiles: Array<{ label: string; value: string; icon: IconName; color: string; href: string; trend?: number[] }> = [
    {
      label: t('dash.disciplineScore'),
      value: `${stats.disciplineScore}%`,
      icon: 'shield',
      color: '#e9a76b',
      href: '/stats',
      trend: week.map((day) => day.disciplineScore),
    },
    {
      label: t('dash.habitsDone'),
      value: `${habitsDone}/${data.habits.length}`,
      icon: 'flame',
      color: '#6e93a8',
      href: '/habits',
      trend: week.map((day) => day.habitsDone),
    },
    {
      label: t('dash.tasksDone'),
      value: String(stats.tasksDone),
      icon: 'checkCircle',
      color: '#5f9aa6',
      href: '/tasks',
      trend: week.map((day) => day.tasksDone),
    },
    {
      label: t('dash.calories'),
      value: n(stats.calories),
      icon: 'apple',
      color: '#d99a63',
      href: '/nutrition',
      trend: week.map((day) => day.calories),
    },
    {
      label: t('dash.currentWeight'),
      value: data.weight ? `${data.weight.weightKg} kg` : '—',
      icon: 'scale',
      color: '#6fa394',
      href: '/weight',
    },
    {
      label: t('dash.focusTime'),
      value: `${Math.floor(stats.focusMinutes / 60)} h ${stats.focusMinutes % 60}`,
      icon: 'clock',
      color: '#8592ad',
      href: '/stats',
      trend: week.map((day) => day.focusMinutes),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* --- Bandeau d'accueil --- */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="lm-card relative overflow-hidden p-6 sm:p-7"
      >
        <div className="lm-aura opacity-70" aria-hidden="true" />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl">
              {t(greetingKey)} <span className="lm-gradient-text">{data.user.firstName}</span>
            </h1>
            <p className="mt-1.5 text-sm capitalize text-[var(--text-muted)]">
              {formatFullDate(locale, new Date(data.localDate), data.user.timezone)}
              <span className="mx-2 text-[var(--text-faint)]">·</span>
              {data.localTime}
              <span className="mx-2 text-[var(--text-faint)]">·</span>
              {data.user.city}
            </p>

            {data.user.mainGoal ? (
              <div className="mt-4 flex items-center gap-2.5">
                <Icon name="target" size={16} className="text-accent-400" />
                <span className="text-sm text-[var(--text)]">{data.user.mainGoal}</span>
              </div>
            ) : (
              <Link href="/settings" className="mt-4 inline-block text-sm text-[var(--brand-text)] hover:opacity-80">
                {t('dash.setMainGoal')}
              </Link>
            )}
          </div>

          <div className="flex items-center gap-5">
            {data.weather && (
              <div className="text-end">
                <div className="flex items-center justify-end gap-2">
                  <Icon name={WEATHER_ICONS[data.weather.icon] ?? 'cloud'} size={22} className="text-[var(--text-muted)]" />
                  <span className="text-3xl font-semibold text-[var(--text)]">{data.weather.temperature}°</span>
                </div>
                <p className="mt-0.5 text-xs capitalize text-[var(--text-faint)]">{data.weather.condition}</p>
                {data.weather.sunrise && (
                  <p className="mt-1.5 text-[11px] text-[var(--text-faint)]">
                    ↑ {data.weather.sunrise} · ↓ {data.weather.sunset}
                  </p>
                )}
              </div>
            )}

            {/* Le libelle est place sous l'anneau : « Progression du jour »
                est trop long pour tenir dans le disque interieur. */}
            <div className="flex flex-col items-center gap-1.5">
              <RingProgress value={stats.completionRate} size={92} thickness={8} color="#e9a76b" />
              <span className="text-[11px] text-[var(--text-faint)]">{t('dash.dailyProgress')}</span>
            </div>
          </div>
        </div>

        <blockquote className="relative mt-6 border-s-2 border-brand-500/40 ps-4">
          <p className="text-pretty text-sm italic leading-relaxed text-[var(--text-muted)]">« {data.quote.text} »</p>
          <footer className="mt-1 text-xs text-[var(--text-faint)]">— {data.quote.author}</footer>
        </blockquote>
      </motion.section>

      {/* --- Tuiles d'indicateurs --- */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((tile, index) => (
          <motion.div
            key={tile.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: index * 0.04 }}
          >
            <Link href={tile.href} className="lm-card block p-4 transition-all hover:-translate-y-0.5 hover:border-[var(--border-strong)]">
              <div className="flex items-start justify-between">
                <span
                  className="grid size-8 place-items-center rounded-lg"
                  style={{ background: `${tile.color}1f`, color: tile.color }}
                >
                  <Icon name={tile.icon} size={16} />
                </span>
                {tile.trend && tile.trend.some((value) => value > 0) && (
                  <Sparkline values={tile.trend} color={tile.color} width={44} height={20} />
                )}
              </div>
              <p className="mt-3 text-xl font-semibold text-[var(--text)]">{tile.value}</p>
              <p className="mt-0.5 text-[11px] leading-tight text-[var(--text-faint)]">{tile.label}</p>
            </Link>
          </motion.div>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* --- Habitudes du jour --- */}
        <Card className="lg:col-span-2">
          <CardHeader
            title={t('habits.title')}
            subtitle={`${habitsDone} ${t('common.of')} ${data.habits.length}`}
            icon="flame"
            accent="#6e93a8"
            action={
              <Link href="/habits">
                <Button variant="ghost" size="sm" icon="chevronRight" />
              </Link>
            }
          />

          {data.habits.length === 0 ? (
            <EmptyState
              icon="flame"
              title={t('habits.empty')}
              action={
                <Link href="/habits">
                  <Button size="sm" icon="plus">
                    {t('habits.new')}
                  </Button>
                </Link>
              }
            />
          ) : (
            <ul className="space-y-1.5">
              {data.habits.map((habit) => (
                <li key={habit.id}>
                  <button
                    type="button"
                    onClick={() => toggleHabit(habit.id, habit.done)}
                    aria-pressed={habit.done}
                    className={cx(
                      'flex w-full items-center gap-3 rounded-xl border p-3 text-start transition-all',
                      habit.done
                        ? 'border-transparent bg-[var(--surface-2)]'
                        : 'border-[var(--border)] hover:border-[var(--border-strong)]',
                    )}
                  >
                    <span
                      className="grid size-8 shrink-0 place-items-center rounded-lg transition-colors"
                      style={{
                        background: habit.done ? habit.color : `${habit.color}1a`,
                        color: habit.done ? '#fff' : habit.color,
                      }}
                    >
                      <Icon name={habit.done ? 'check' : (habit.icon as IconName)} size={16} />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span
                        className={cx(
                          'block truncate text-sm',
                          habit.done ? 'text-[var(--text-faint)] line-through' : 'text-[var(--text)]',
                        )}
                      >
                        {habit.name}
                      </span>
                      {habit.targetPerDay > 1 && (
                        <span className="text-[11px] text-[var(--text-faint)]">
                          {habit.count}/{habit.targetPerDay} {habit.unit ?? ''}
                        </span>
                      )}
                    </span>

                    {habit.isNegative && <Badge color="#d99a63">à éviter</Badge>}
                    <span className="text-[11px] font-medium text-[var(--text-faint)]">+{habit.xpReward} XP</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* --- Prieres --- */}
        <Card>
          <CardHeader
            title={t('prayers.title')}
            subtitle={
              data.prayers?.next && data.prayers.minutesToNext !== null
                ? `${t('dash.nextPrayer')} : ${data.prayers.next} ${t('prayers.in')} ${Math.floor(data.prayers.minutesToNext / 60)}h${String(data.prayers.minutesToNext % 60).padStart(2, '0')}`
                : undefined
            }
            icon="moon"
            accent="#5e9c9b"
            action={
              <Link href="/prayers">
                <Button variant="ghost" size="sm" icon="chevronRight" />
              </Link>
            }
          />

          {data.prayers ? (
            <ul className="space-y-1">
              {(['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const).map((name) => {
                const logged = data.prayers!.logged.find((entry) => entry.name === name);
                const isNext = data.prayers!.next === name;
                return (
                  <li
                    key={name}
                    className={cx(
                      'flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
                      isNext && 'bg-[#5e9c9b]/10',
                    )}
                  >
                    <span className={cx('flex items-center gap-2', isNext ? 'font-medium text-[#5e9c9b]' : 'text-[var(--text-muted)]')}>
                      {logged?.status === 'done' && <Icon name="check" size={13} className="text-[#6fa394]" />}
                      {t(`prayers.${name.toLowerCase()}` as 'prayers.fajr')}
                    </span>
                    <span className={cx('tabular-nums', isNext ? 'font-semibold text-[#5e9c9b]' : 'text-[var(--text)]')}>
                      {data.prayers!.times[name]}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon="moon" title={t('common.empty')} />
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* --- Semaine --- */}
        <Card className="lg:col-span-2">
          <CardHeader title={t('dash.weekOverview')} subtitle={t('dash.last7days')} icon="chart" accent="#e9a76b" />
          <BarChart
            data={week.map((day) => ({
              label: new Date(`${day.date}T12:00:00Z`).toLocaleDateString(locale, { weekday: 'narrow' }),
              value: day.disciplineScore,
            }))}
            color="#e9a76b"
            unit="%"
            maxValue={100}
            height={160}
          />
        </Card>

        {/* --- Progression & taches --- */}
        <div className="space-y-4">
          <Card>
            <CardHeader title={t('dash.level')} icon="award" accent="#8592ad" />
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-[var(--text)]">{data.progress.level}</span>
              <span className="text-sm text-[var(--text-faint)]">{n(data.progress.xp)} XP</span>
            </div>
            <Progress value={data.progress.percent} color="var(--color-accent-500)" label={t('dash.xp')} />
            <div className="mt-3 flex items-center justify-between text-xs text-[var(--text-faint)]">
              <span className="flex items-center gap-1.5">
                <Icon name="flame" size={13} className="text-[#d99a63]" />
                {data.user.currentStreak} {t('common.days')}
              </span>
              <span className="flex items-center gap-1.5">
                <Icon name="award" size={13} className="text-[#d99a63]" />
                {data.badgeCount} {t('dash.badges')}
              </span>
            </div>
          </Card>

          <Card>
            <CardHeader
              title={t('tasks.title')}
              icon="checkCircle"
              accent="#5f9aa6"
              action={
                <Link href="/tasks">
                  <Button variant="ghost" size="sm" icon="chevronRight" />
                </Link>
              }
            />
            {data.tasks.length === 0 ? (
              <p className="py-4 text-center text-xs text-[var(--text-faint)]">{t('tasks.empty')}</p>
            ) : (
              <ul className="space-y-1.5">
                {data.tasks.map((task) => (
                  <li key={task.id} className="flex items-center gap-2.5 text-sm">
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{
                        background:
                          task.priority === 'urgent' ? '#c97f63' : task.priority === 'high' ? '#d99a63' : '#7d8f95',
                      }}
                    />
                    <span className="min-w-0 flex-1 truncate text-[var(--text-muted)]">{task.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
