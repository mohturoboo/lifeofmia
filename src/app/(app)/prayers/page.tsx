'use client';

import { useState } from 'react';
import { api, useResource } from '@/lib/client/api';
import { useMutate } from '@/lib/client/mutate';
import { Badge, Card, CardHeader, cx, Progress, Select, Skeleton } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { PageHeader, DateNav } from '@/components/page-header';
import { useI18n } from '@/i18n/provider';
import { dateKeyIn } from '@/lib/date';

interface PrayerData {
  date: string;
  times: Record<string, string>;
  source: 'aladhan' | 'local';
  current: string | null;
  next: string | null;
  minutesToNext: number | null;
  logs: Array<{ name: string; status: string }>;
  settings: { method: number; school: number; notifyBefore: number; notifications: boolean };
  methods: Array<{ id: number; name: string }>;
  location: { city: string; country: string; latitude: number; longitude: number; timezone: string };
  monthlyRate: number;
  monthLogs: Array<{ date: string; name: string; status: string }>;
}

/** `Sunrise` (Chourouk) est affiche mais n'est pas une priere obligatoire. */
const PRAYERS = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;
const OBLIGATORY = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

export default function PrayersPage() {
  const { t, locale } = useI18n();
  // Aucun formulaire sur cette page : seul le lancement d'ecriture est utile.
  const { run: mutate } = useMutate();

  const [date, setDate] = useState(() => dateKeyIn(Intl.DateTimeFormat().resolvedOptions().timeZone));
  const { data, loading, refresh } = useResource<PrayerData>(`/api/prayers?date=${date}`, [date]);

  async function mark(name: string, status: 'done' | 'late' | 'missed') {
    const saved = await mutate(() => api.post('/api/prayers', { date, name, status }));
    if (saved) void refresh();
  }

  /**
   * Les reglages de calcul ne rendaient compte de rien : ni reussite, ni echec.
   * Une methode refusee par le serveur laissait l'utilisateur devant un choix
   * qui semblait pris alors qu'il ne l'etait pas.
   */
  async function updateSettings(patch: Record<string, number | boolean>) {
    const saved = await mutate(() => api.patch('/api/prayers', patch));
    if (saved) void refresh();
  }

  if (loading || !data) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  const statusOf = (name: string) => data.logs.find((log) => log.name === name)?.status;
  const doneToday = data.logs.filter((log) => log.status !== 'missed').length;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t('prayers.title')}
        subtitle={`${data.location.city}, ${data.location.country}`}
        icon="moon"
        color="#dcc7ea"
        actions={<DateNav date={date} onChange={setDate} locale={locale} />}
      />

      {data.next && data.minutesToNext !== null && (
        <Card className="mb-4 border-[#dcc7ea]/25 bg-[#dcc7ea]/[0.06]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs text-[var(--text-faint)]">{t('dash.nextPrayer')}</p>
              <p className="mt-0.5 text-2xl font-semibold text-[#dcc7ea]">
                {t(`prayers.${data.next.toLowerCase()}` as 'prayers.fajr')}
                <span className="ms-2 text-base font-normal text-[var(--text-muted)]">{data.times[data.next]}</span>
              </p>
            </div>
            <div className="text-end">
              <p className="text-xs text-[var(--text-faint)]">{t('prayers.in')}</p>
              <p className="mt-0.5 text-2xl font-semibold tabular-nums text-[var(--text)]">
                {Math.floor(data.minutesToNext / 60)}h{String(data.minutesToNext % 60).padStart(2, '0')}
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title={t('prayers.title')}
            subtitle={data.source === 'local' ? t('prayers.sourceLocal') : t('prayers.sourceApi')}
            icon="clock"
            accent="#dcc7ea"
            action={<Badge color="#dcc7ea">{doneToday}/5</Badge>}
          />

          <ul className="space-y-1.5">
            {PRAYERS.map((name) => {
              const status = statusOf(name);
              const isNext = data.next === name;
              const isObligatory = OBLIGATORY.includes(name);

              return (
                <li
                  key={name}
                  className={cx(
                    'flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors',
                    isNext ? 'border-[#dcc7ea]/40 bg-[#dcc7ea]/[0.07]' : 'border-[var(--border)]',
                  )}
                >
                  <span
                    className={cx(
                      'grid size-9 shrink-0 place-items-center rounded-xl',
                      status === 'done'
                        ? 'bg-[#f6d9e4] text-[var(--on-pink)]'
                        : status === 'late'
                          ? 'bg-[#ff9fbf] text-[var(--on-pink)]'
                          : status === 'missed'
                            ? 'bg-red-500/15 text-red-500'
                            : 'bg-[var(--surface-2)] text-[var(--text-faint)]',
                    )}
                  >
                    <Icon name={status === 'done' ? 'check' : name === 'Sunrise' ? 'sun' : 'moon'} size={17} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className={cx('text-sm', isNext ? 'font-medium text-[#dcc7ea]' : 'text-[var(--text)]')}>
                      {t(`prayers.${name.toLowerCase()}` as 'prayers.fajr')}
                    </p>
                    {!isObligatory && <p className="text-[11px] text-[var(--text-faint)]">{t('dash.sunrise')}</p>}
                  </div>

                  <span className="shrink-0 text-lg font-semibold tabular-nums text-[var(--text)]">
                    {data.times[name]}
                  </span>

                  {isObligatory && (
                    <div className="flex shrink-0 gap-1">
                      {(
                        [
                          ['done', 'check', '#fbe3ec', t('prayers.markDone')],
                          ['late', 'clock', '#ff9fbf', t('prayers.markLate')],
                          ['missed', 'close', '#ff9fbf', t('prayers.markMissed')],
                        ] as const
                      ).map(([value, icon, color, label]) => (
                        /*
                          Groupe de bascules, pas un simple bouton-icone : chaque
                          etat porte sa couleur et son `aria-pressed`. Seule la
                          CIBLE passe a 44 px, la pastille coloree gardant ses
                          28 px pour ne pas alourdir la ligne.
                        */
                        <button
                          key={value}
                          type="button"
                          onClick={() => mark(name, value)}
                          aria-label={`${label} — ${name}`}
                          aria-pressed={status === value}
                          className="grid size-11 shrink-0 place-items-center rounded-full"
                        >
                          <span
                            className="grid size-7 place-items-center rounded-lg lm-transition-ui"
                            style={{
                              background: status === value ? `${color}22` : 'transparent',
                              color: status === value ? color : 'var(--text-faint)',
                            }}
                          >
                            <Icon name={icon} size={13} />
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title={t('prayers.monthlyRate')} icon="chart" accent="#dcc7ea" />
            <p className="text-3xl font-semibold text-[var(--text)]">{data.monthlyRate}%</p>
            <div className="mt-3">
              <Progress value={data.monthlyRate} color="#dcc7ea" label={t('prayers.monthlyRate')} />
            </div>
          </Card>

          <Card>
            <CardHeader title={t('settings.title')} icon="settings" accent="#dcc7ea" />
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-[13px] text-[var(--text-muted)]">{t('prayers.method')}</span>
                <Select
                  value={data.settings.method}
                  onChange={(event) => updateSettings({ method: Number(event.target.value) })}
                >
                  {data.methods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[13px] text-[var(--text-muted)]">{t('prayers.school')}</span>
                <Select
                  value={data.settings.school}
                  onChange={(event) => updateSettings({ school: Number(event.target.value) })}
                >
                  <option value={0}>{t('prayers.schoolShafi')}</option>
                  <option value={1}>{t('prayers.schoolHanafi')}</option>
                </Select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[13px] text-[var(--text-muted)]">{t('prayers.notifyBefore')}</span>
                <Select
                  value={data.settings.notifyBefore}
                  onChange={(event) => updateSettings({ notifyBefore: Number(event.target.value) })}
                >
                  {[0, 5, 10, 15, 30].map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} min
                    </option>
                  ))}
                </Select>
              </label>

              <p className="pt-1 text-[11px] leading-relaxed text-[var(--text-faint)]">
                Les horaires suivent votre ville. Changez-la dans les reglages pour les mettre a jour automatiquement.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
