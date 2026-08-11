'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { api, useResource } from '@/lib/client/api';
import { useMutate } from '@/lib/client/mutate';
import { Badge, Button, Card, CardHeader, EmptyState, Progress, Skeleton, cx } from '@/components/ui/primitives';
import { Icon, type IconName } from '@/components/ui/icons';
import { BarChart, RingProgress, Sparkline } from '@/components/charts';
import { useI18n } from '@/i18n/provider';
import { formatFullDate } from '@/i18n';
import type { DayStats } from '@/lib/stats';
import type { LevelProgress } from '@/lib/levels';

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
  // Aucun formulaire sur cette page : seul le lancement d'ecriture est utile.
  const { run: mutate } = useMutate();
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

    // `try/finally` sans `catch` laissait le rejet remonter sans etre traite :
    // la case revenait a son etat initial au rafraichissement, sans explication.
    await mutate(
      () =>
        api.post(`/api/habits/${habitId}/log`, {
          date: data.today,
          count: done ? 0 : undefined,
          status: done ? 'skipped' : 'done',
        }),
      { notifySuccess: false },
    );
    void refresh();
  }

  if (loading || !data) {
    return (
      <div className="mx-auto max-w-7xl space-y-4">
        <Skeleton className="h-28 rounded-3xl" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
      color: '#fbc7da',
      href: '/stats',
      trend: week.map((day) => day.disciplineScore),
    },
    {
      label: t('dash.habitsDone'),
      value: `${habitsDone}/${data.habits.length}`,
      icon: 'flame',
      color: '#e9b8d5',
      href: '/habits',
      trend: week.map((day) => day.habitsDone),
    },
    {
      label: t('dash.tasksDone'),
      value: String(stats.tasksDone),
      icon: 'checkCircle',
      color: '#e6e6e6',
      href: '/tasks',
      trend: week.map((day) => day.tasksDone),
    },
    {
      label: t('dash.calories'),
      value: n(stats.calories),
      icon: 'apple',
      color: '#ff9fbf',
      href: '/nutrition',
      trend: week.map((day) => day.calories),
    },
    {
      label: t('dash.currentWeight'),
      value: data.weight ? `${data.weight.weightKg} kg` : '—',
      icon: 'scale',
      color: '#f6d9e4',
      href: '/weight',
    },
    {
      label: t('dash.focusTime'),
      value: `${Math.floor(stats.focusMinutes / 60)} h ${stats.focusMinutes % 60}`,
      icon: 'clock',
      color: '#d9c7f0',
      href: '/stats',
      trend: week.map((day) => day.focusMinutes),
    },
  ];

  return (
    <div className="lm-entree mx-auto max-w-7xl space-y-5">
      {/*
        --- Ouverture ---
        L'accueil n'est plus une carte : le titre respire directement sur le
        noir, centre, avec l'anneau de progression pose au-dessus. La date, la
        meteo et le lieu descendent en une ligne unique de metadonnees, ce qui
        libere tout le haut de page pour la seule information qui compte.
      */}
      <section
        className="relative flex flex-col items-center px-4 pb-2 pt-6 text-center sm:pt-10"
      >
        {/*
          --- L'anneau porte desormais son nom ---
          Trois pourcentages differents cohabitent sur cette page : l'anneau
          (habitudes ET taches du jour), le score de discipline (moyenne
          ponderee qui compte aussi prieres, sport et concentration) et le
          compteur d'habitudes. Ils mesurent trois choses distinctes, mais
          l'anneau n'annoncait pas laquelle : trois nombres proches et
          contradictoires, sans moyen de les reconcilier. Le libelle et le
          rapport brut affiches sous l'anneau rendent son calcul verifiable.
        */}
        <RingProgress
          value={stats.completionRate}
          size={104}
          thickness={5}
          color="#fbc7da"
          label={t('dash.dailyProgress')}
        />
        <p className="mt-2.5 text-center text-[11px] leading-tight text-[var(--text-faint)]">
          <span className="font-medium text-[var(--text-muted)]">{t('dash.dailyProgress')}</span>
          <span className="mx-1.5 text-brand-300/50">·</span>
          <span className="tabular-nums">
            {stats.habitsDone + stats.tasksDone}/{stats.habitsTotal + stats.tasksTotal}
          </span>{' '}
          {t('habits.title').toLowerCase()} + {t('tasks.title').toLowerCase()}
        </p>

        <h1 className="mt-6 text-4xl font-medium tracking-tight text-[var(--text)] sm:text-5xl">
          {t(greetingKey)} <span className="lm-gradient-text">{data.user.firstName}</span>
        </h1>

        <p className="lm-eyebrow mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <span className="capitalize">{formatFullDate(locale, new Date(data.localDate), data.user.timezone)}</span>
          <span className="text-brand-300/50">◆</span>
          <span>{data.localTime}</span>
          <span className="text-brand-300/50">◆</span>
          <span>{data.user.city}</span>
          {data.weather && (
            <>
              <span className="text-brand-300/50">◆</span>
              <span className="inline-flex items-center gap-1.5 normal-case tracking-normal">
                <Icon name={WEATHER_ICONS[data.weather.icon] ?? 'cloud'} size={13} />
                {data.weather.temperature}° {data.weather.condition}
              </span>
            </>
          )}
        </p>

        {data.user.mainGoal ? (
          <p className="mt-5 inline-flex max-w-xl items-center gap-2.5 rounded-full border border-brand-300/20 bg-brand-300/[0.06] px-5 py-2.5 text-sm text-[var(--text)]">
            <Icon name="target" size={15} className="shrink-0 text-brand-300" />
            {data.user.mainGoal}
          </p>
        ) : (
          <Link
            href="/settings"
            className="mt-5 inline-block text-sm text-[var(--brand-text)] transition-opacity hover:opacity-80"
          >
            {t('dash.setMainGoal')}
          </Link>
        )}

        <blockquote className="mx-auto mt-8 max-w-2xl">
          <div className="lm-rule mx-auto mb-5 w-24 opacity-60" />
          <p className="text-pretty font-display text-lg italic leading-relaxed text-[var(--text-muted)] sm:text-xl">
            « {data.quote.text} »
          </p>
          <footer className="lm-eyebrow mt-3">{data.quote.author}</footer>
        </blockquote>
      </section>

      {/*
        --- Indicateurs ---
        Grille de quatre colonnes plutot que six : chaque tuile gagne en surface,
        le chiffre devient l'element dominant et la courbe passe en fond.
      */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {tiles.map((tile) => (
          <div
            key={tile.label}
          >
            <Link href={tile.href} className="lm-card lm-card-hover group relative block overflow-hidden p-4">
              {/* La courbe de tendance passe en filigrane au fond de la tuile. */}
              {tile.trend && tile.trend.some((value) => value > 0) && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 opacity-25 transition-opacity duration-300 group-hover:opacity-50">
                  <Sparkline values={tile.trend} color={tile.color} width={200} height={44} />
                </div>
              )}

              <div className="relative">
                <span
                  className="grid size-8 place-items-center rounded-xl transition-transform duration-300 group-hover:scale-110"
                  style={{ background: `${tile.color}1a`, color: tile.color, boxShadow: `0 0 20px -10px ${tile.color}` }}
                >
                  <Icon name={tile.icon} size={16} />
                </span>
                <p className="lm-numeric mt-4 text-2xl font-medium text-[var(--text)]">{tile.value}</p>
                <p className="mt-1 text-[11px] leading-tight text-[var(--text-faint)]">{tile.label}</p>
              </div>
            </Link>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* --- Habitudes du jour --- */}
        <Card className="lg:col-span-2">
          <CardHeader
            title={t('habits.title')}
            subtitle={`${habitsDone} ${t('common.of')} ${data.habits.length}`}
            icon="flame"
            accent="#e9b8d5"
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

                    {habit.isNegative && <Badge color="#ff9fbf">à éviter</Badge>}
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
            accent="#dcc7ea"
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
                      isNext && 'bg-[#dcc7ea]/10',
                    )}
                  >
                    <span className={cx('flex items-center gap-2', isNext ? 'font-medium text-[#dcc7ea]' : 'text-[var(--text-muted)]')}>
                      {logged?.status === 'done' && <Icon name="check" size={13} className="text-[#f6d9e4]" />}
                      {t(`prayers.${name.toLowerCase()}` as 'prayers.fajr')}
                    </span>
                    <span className={cx('tabular-nums', isNext ? 'font-semibold text-[#dcc7ea]' : 'text-[var(--text)]')}>
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* --- Semaine --- */}
        <Card className="lg:col-span-2">
          <CardHeader title={t('dash.weekOverview')} subtitle={t('dash.last7days')} icon="chart" accent="#fbc7da" />
          <BarChart
            data={week.map((day) => ({
              label: new Date(`${day.date}T12:00:00Z`).toLocaleDateString(locale, { weekday: 'narrow' }),
              value: day.disciplineScore,
            }))}
            color="#fbc7da"
            unit="%"
            maxValue={100}
            height={160}
            emptyLabel={t('common.empty')}
          />
        </Card>

        {/* --- Progression & taches --- */}
        <div className="space-y-4">
          <Card>
            <CardHeader title={t('dash.level')} icon="award" accent="#d9c7f0" />
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-[var(--text)]">{data.progress.level}</span>
              <span className="text-sm text-[var(--text-faint)]">{n(data.progress.xp)} XP</span>
            </div>
            <Progress value={data.progress.percent} color="var(--color-accent-500)" label={t('dash.xp')} />
            <div className="mt-3 flex items-center justify-between text-xs text-[var(--text-faint)]">
              <span className="flex items-center gap-1.5">
                <Icon name="flame" size={13} className="text-[#ff9fbf]" />
                {data.user.currentStreak} {t('common.days')}
              </span>
              <span className="flex items-center gap-1.5">
                <Icon name="award" size={13} className="text-[#ff9fbf]" />
                {data.badgeCount} {t('dash.badges')}
              </span>
            </div>
          </Card>

          <Card>
            <CardHeader
              title={t('tasks.title')}
              icon="checkCircle"
              accent="#e6e6e6"
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
                          task.priority === 'urgent' ? '#ff9fbf' : task.priority === 'high' ? '#ff9fbf' : '#b4b4b4',
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
