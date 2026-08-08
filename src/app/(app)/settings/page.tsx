'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiClientError, useResource } from '@/lib/client/api';
import { Badge, Button, Card, CardHeader, Field, Input, Select, Skeleton, cx } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { useToast } from '@/components/ui/toast';
import { PageHeader } from '@/components/page-header';
import { useI18n } from '@/i18n/provider';
import { useTheme, type Theme } from '@/components/theme-provider';
import { LOCALES, LOCALE_META, type Locale } from '@/i18n/config';
import { FALLBACK_CITIES } from '@/lib/weather';
import type { LevelProgress } from '@/lib/gamification';

interface ProfileData {
  profile: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    country: string;
    city: string;
    timezone: string;
    locale: Locale;
    theme: Theme;
    timeFormat: '12h' | '24h';
    units: 'metric' | 'imperial';
    birthDate: string | null;
    gender: string | null;
    heightCm: number | null;
    mainGoal: string | null;
    emailVerified: string | null;
    marketingOptIn: boolean;
    createdAt: string;
  };
  progress: LevelProgress;
  badges: Array<{ code: string; name: string; tier: string }>;
  sessions: Array<{ id: string; userAgent: string | null; ip: string | null; createdAt: string }>;
}

type Section = 'profile' | 'localization' | 'appearance' | 'security' | 'data';

export default function SettingsPage() {
  const { t, locale, setLocale, n } = useI18n();
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const router = useRouter();

  const { data, loading, refresh } = useResource<ProfileData>('/api/profile');
  const [section, setSection] = useState<Section>('profile');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    city: '',
    country: '',
    timezone: '',
    birthDate: '',
    gender: '',
    heightCm: '',
    mainGoal: '',
    timeFormat: '24h' as '12h' | '24h',
    units: 'metric' as 'metric' | 'imperial',
  });

  const [passwords, setPasswords] = useState({ current: '', next: '' });
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const { profile } = data;
    setForm({
      firstName: profile.firstName,
      lastName: profile.lastName,
      city: profile.city,
      country: profile.country,
      timezone: profile.timezone,
      birthDate: profile.birthDate ? profile.birthDate.slice(0, 10) : '',
      gender: profile.gender ?? '',
      heightCm: profile.heightCm ? String(profile.heightCm) : '',
      mainGoal: profile.mainGoal ?? '',
      timeFormat: profile.timeFormat,
      units: profile.units,
    });
  }, [data]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function saveProfile() {
    setSaving(true);
    try {
      await api.patch('/api/profile', {
        firstName: form.firstName,
        lastName: form.lastName,
        city: form.city,
        country: form.country,
        timezone: form.timezone,
        birthDate: form.birthDate || null,
        gender: form.gender || null,
        heightCm: form.heightCm ? Number(form.heightCm) : null,
        mainGoal: form.mainGoal || null,
        timeFormat: form.timeFormat,
        units: form.units,
      });
      toast.success(t('settings.saved'));
      router.refresh();
      void refresh();
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    setPasswordError(null);
    setSaving(true);
    try {
      await api.post('/api/profile/password', {
        currentPassword: passwords.current,
        newPassword: passwords.next,
      });
      toast.success(t('settings.saved'));
      setPasswords({ current: '', next: '' });
    } catch (caught) {
      setPasswordError(caught instanceof ApiClientError ? caught.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  async function resendVerification() {
    await api.put('/api/auth/verify-email').catch(() => undefined);
    toast.success(t('auth.verifyPending'));
  }

  async function deleteAccount() {
    if (!window.confirm(`${t('settings.deleteHint')}\n\n${t('common.deleteConfirm')}`)) return;
    await api.delete('/api/profile').catch(() => toast.error(t('common.error')));
    router.push('/');
  }

  if (loading || !data) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  const sections: Array<{ id: Section; label: string; icon: 'user' | 'globe' | 'sun' | 'shield' | 'download' }> = [
    { id: 'profile', label: t('settings.profile'), icon: 'user' },
    { id: 'localization', label: t('settings.localization'), icon: 'globe' },
    { id: 'appearance', label: t('settings.appearance'), icon: 'sun' },
    { id: 'security', label: t('settings.security'), icon: 'shield' },
    { id: 'data', label: t('settings.data'), icon: 'download' },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t('settings.title')} icon="settings" color="#7d8f95" />

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
        {sections.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSection(item.id)}
            aria-pressed={section === item.id}
            className={cx(
              'flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] transition-colors',
              section === item.id
                ? 'bg-[var(--surface-2)] font-medium text-[var(--text)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]',
            )}
          >
            <Icon name={item.icon} size={15} />
            {item.label}
          </button>
        ))}
      </div>

      {section === 'profile' && (
        <Card>
          <CardHeader title={t('settings.profile')} icon="user" accent="#7d8f95" />
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('auth.firstName')} htmlFor="first-name">
                <Input id="first-name" value={form.firstName} onChange={(event) => set('firstName', event.target.value)} />
              </Field>
              <Field label={t('auth.lastName')} htmlFor="last-name">
                <Input id="last-name" value={form.lastName} onChange={(event) => set('lastName', event.target.value)} />
              </Field>
            </div>

            <Field label={t('auth.email')} htmlFor="email">
              <div className="flex items-center gap-2">
                <Input id="email" value={data.profile.email} disabled className="flex-1" />
                {data.profile.emailVerified ? (
                  <Badge color="#7ba083">
                    <Icon name="check" size={11} /> Verifie
                  </Badge>
                ) : (
                  <Button variant="secondary" size="sm" onClick={resendVerification}>
                    {t('auth.resendVerification')}
                  </Button>
                )}
              </div>
            </Field>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t('auth.birthDate')} htmlFor="birth-date">
                <Input id="birth-date" type="date" value={form.birthDate} onChange={(event) => set('birthDate', event.target.value)} />
              </Field>
              <Field label={t('auth.gender')} htmlFor="gender">
                <Select id="gender" value={form.gender} onChange={(event) => set('gender', event.target.value)}>
                  <option value="">—</option>
                  <option value="male">{t('auth.genderMale')}</option>
                  <option value="female">{t('auth.genderFemale')}</option>
                  <option value="other">{t('auth.genderOther')}</option>
                </Select>
              </Field>
              <Field label={`${t('settings.height')} (cm)`} htmlFor="height" hint="Necessaire pour l'IMC">
                <Input id="height" type="number" min={50} max={280} value={form.heightCm} onChange={(event) => set('heightCm', event.target.value)} />
              </Field>
            </div>

            <Field label={t('auth.mainGoal')} htmlFor="main-goal">
              <Input
                id="main-goal"
                value={form.mainGoal}
                onChange={(event) => set('mainGoal', event.target.value)}
                placeholder={t('auth.mainGoalPlaceholder')}
              />
            </Field>

            <Button onClick={saveProfile} loading={saving}>
              {t('common.save')}
            </Button>
          </div>
        </Card>
      )}

      {section === 'localization' && (
        <Card>
          <CardHeader
            title={t('settings.localization')}
            subtitle="Change la ville met automatiquement a jour la meteo et les horaires de priere."
            icon="globe"
            accent="#5f9aa6"
          />
          <div className="space-y-4">
            <Field label={t('auth.language')} htmlFor="locale">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {LOCALES.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setLocale(code)}
                    aria-pressed={locale === code}
                    className={cx(
                      'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] transition-colors',
                      locale === code
                        ? 'border-brand-500/40 bg-brand-500/8 text-[var(--text)]'
                        : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)]',
                    )}
                  >
                    <span aria-hidden="true">{LOCALE_META[code].flag}</span>
                    {LOCALE_META[code].label}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('auth.city')} htmlFor="city">
                <Input id="city" list="cities" value={form.city} onChange={(event) => set('city', event.target.value)} />
                <datalist id="cities">
                  {Object.keys(FALLBACK_CITIES).map((city) => (
                    <option key={city} value={city} />
                  ))}
                </datalist>
              </Field>
              <Field label={t('auth.country')} htmlFor="country">
                <Input id="country" value={form.country} onChange={(event) => set('country', event.target.value)} />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t('auth.timezone')} htmlFor="timezone">
                <Input id="timezone" value={form.timezone} onChange={(event) => set('timezone', event.target.value)} />
              </Field>
              <Field label={t('settings.timeFormat')} htmlFor="time-format">
                <Select id="time-format" value={form.timeFormat} onChange={(event) => set('timeFormat', event.target.value as '12h' | '24h')}>
                  <option value="24h">24 h</option>
                  <option value="12h">12 h (AM/PM)</option>
                </Select>
              </Field>
              <Field label={t('settings.units')} htmlFor="units">
                <Select id="units" value={form.units} onChange={(event) => set('units', event.target.value as 'metric' | 'imperial')}>
                  <option value="metric">{t('settings.unitsMetric')}</option>
                  <option value="imperial">{t('settings.unitsImperial')}</option>
                </Select>
              </Field>
            </div>

            <Button onClick={saveProfile} loading={saving}>
              {t('common.save')}
            </Button>
          </div>
        </Card>
      )}

      {section === 'appearance' && (
        <Card>
          <CardHeader title={t('settings.appearance')} icon="sun" accent="#d99a63" />
          <Field label={t('settings.theme')}>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ['dark', t('settings.themeDark'), 'moon'],
                  ['light', t('settings.themeLight'), 'sun'],
                  ['system', t('settings.themeSystem'), 'settings'],
                ] as const
              ).map(([value, label, icon]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  aria-pressed={theme === value}
                  className={cx(
                    'flex flex-col items-center gap-2 rounded-xl border py-4 transition-colors',
                    theme === value
                      ? 'border-brand-500/40 bg-brand-500/8 text-[var(--text)]'
                      : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)]',
                  )}
                >
                  <Icon name={icon} size={19} />
                  <span className="text-[13px]">{label}</span>
                </button>
              ))}
            </div>
          </Field>
        </Card>
      )}

      {section === 'security' && (
        <div className="space-y-4">
          <Card>
            <CardHeader title={t('settings.changePassword')} icon="lock" accent="#c97f63" />
            <div className="space-y-4">
              {passwordError && (
                <div role="alert" className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-500">
                  {passwordError}
                </div>
              )}
              <Field label={t('auth.currentPassword')} htmlFor="current-password">
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={passwords.current}
                  onChange={(event) => setPasswords((current) => ({ ...current, current: event.target.value }))}
                />
              </Field>
              <Field label={t('auth.newPassword')} htmlFor="new-password" hint="8 caracteres minimum, avec majuscule et chiffre">
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={passwords.next}
                  onChange={(event) => setPasswords((current) => ({ ...current, next: event.target.value }))}
                />
              </Field>
              <Button onClick={changePassword} loading={saving} disabled={!passwords.current || passwords.next.length < 8}>
                {t('common.save')}
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader title={t('settings.sessions')} subtitle={`${data.sessions.length} appareil(s)`} icon="shield" accent="#5f9aa6" />
            <ul className="space-y-2">
              {data.sessions.map((session) => (
                <li key={session.id} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-2)] px-3.5 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-[var(--text)]">
                      {session.userAgent?.slice(0, 60) ?? 'Appareil inconnu'}
                    </p>
                    <p className="text-[11px] text-[var(--text-faint)]">
                      {session.ip ?? '—'} · {new Date(session.createdAt).toLocaleDateString(locale)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-[var(--text-faint)]">
              Changer de mot de passe deconnecte automatiquement tous les autres appareils.
            </p>
          </Card>
        </div>
      )}

      {section === 'data' && (
        <div className="space-y-4">
          <Card>
            <CardHeader title={t('settings.exportData')} subtitle={t('settings.exportHint')} icon="download" accent="#7ba083" />
            <a
              href="/api/profile/export"
              download
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-5 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface-hover)]"
            >
              <Icon name="download" size={16} />
              {t('settings.exportData')}
            </a>
          </Card>

          <Card>
            <CardHeader title={t('dash.badges')} subtitle={`${data.badges.length} debloques`} icon="award" accent="#d99a63" />
            <div className="flex flex-wrap gap-2">
              {data.badges.length === 0 ? (
                <p className="text-xs text-[var(--text-faint)]">{t('common.empty')}</p>
              ) : (
                data.badges.map((badge) => <Badge key={badge.code} color="#d99a63">{badge.name}</Badge>)
              )}
            </div>
            <p className="mt-3 text-xs text-[var(--text-faint)]">
              {t('dash.level')} {data.progress.level} · {n(data.progress.xp)} XP
            </p>
          </Card>

          <Card className="border-red-500/25">
            <CardHeader title={t('settings.deleteAccount')} subtitle={t('settings.deleteHint')} icon="trash" accent="#c97f63" />
            <Button variant="danger" icon="trash" onClick={deleteAccount}>
              {t('settings.deleteAccount')}
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
