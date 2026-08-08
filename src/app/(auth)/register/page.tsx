'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';
import { api, ApiClientError } from '@/lib/client/api';
import { Button, Checkbox, Field, Input, Select, cx } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { evaluatePassword } from '@/lib/auth/password';
import { LOCALES, LOCALE_META, type Locale } from '@/i18n/config';
import { FALLBACK_CITIES } from '@/lib/weather';
import { useT } from '@/i18n/provider';

/**
 * Inscription en deux etapes.
 *
 * Decouper le formulaire evite le mur de quinze champs : la premiere etape ne
 * demande que l'identite et le mot de passe, la seconde le contexte (lieu,
 * langue, objectif) qui personnalise immediatement le tableau de bord.
 */
export default function RegisterPage() {
  const t = useT();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    country: 'France',
    city: 'Paris',
    timezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Europe/Paris',
    locale: 'fr' as Locale,
    birthDate: '',
    gender: '' as '' | 'male' | 'female' | 'other',
    mainGoal: '',
    acceptTerms: false,
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const strength = useMemo(() => evaluatePassword(form.password), [form.password]);
  const strengthLabel = [t('auth.passwordWeak'), t('auth.passwordWeak'), t('auth.passwordMedium'), t('auth.passwordStrong'), t('auth.passwordStrong')][strength.score];
  const strengthColor = ['#c97f63', '#c97f63', '#d99a63', '#7ba083', '#7ba083'][strength.score];

  const step1Valid =
    form.firstName.trim().length > 0 &&
    form.lastName.trim().length > 0 &&
    /\S+@\S+\.\S+/.test(form.email) &&
    strength.score >= 2;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (step === 1) {
      if (step1Valid) setStep(2);
      return;
    }

    setLoading(true);
    setError(null);
    setFields({});

    try {
      await api.post('/api/auth/register', {
        ...form,
        gender: form.gender || undefined,
        birthDate: form.birthDate || undefined,
        mainGoal: form.mainGoal.trim() || undefined,
      });
      router.refresh();
      router.push('/dashboard');
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        setError(caught.message);
        setFields(caught.fields ?? {});
        // Une erreur sur un champ de la premiere etape y ramene l'utilisateur.
        if (caught.fields && ['email', 'password', 'firstName', 'lastName'].some((key) => key in caught.fields!)) {
          setStep(1);
        }
      } else {
        setError(t('common.error'));
      }
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        {[1, 2].map((index) => (
          <span
            key={index}
            className={cx('h-1 flex-1 rounded-full transition-colors', index <= step ? 'lm-gradient-bg' : 'bg-[var(--border)]')}
          />
        ))}
        <span className="ms-1 text-xs text-[var(--text-faint)]">
          {t('auth.step')} {step}/2
        </span>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">{t('auth.registerTitle')}</h1>
      <p className="mt-1.5 text-sm text-[var(--text-muted)]">{t('auth.registerSubtitle')}</p>

      <form onSubmit={onSubmit} className="mt-7 space-y-4" noValidate>
        {error && (
          <div role="alert" className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-500">
            {error}
          </div>
        )}

        {step === 1 ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('auth.firstName')} htmlFor="firstName" error={fields.firstName} required>
                <Input
                  id="firstName"
                  autoComplete="given-name"
                  required
                  value={form.firstName}
                  onChange={(event) => set('firstName', event.target.value)}
                  invalid={Boolean(fields.firstName)}
                />
              </Field>
              <Field label={t('auth.lastName')} htmlFor="lastName" error={fields.lastName} required>
                <Input
                  id="lastName"
                  autoComplete="family-name"
                  required
                  value={form.lastName}
                  onChange={(event) => set('lastName', event.target.value)}
                  invalid={Boolean(fields.lastName)}
                />
              </Field>
            </div>

            <Field label={t('auth.email')} htmlFor="email" error={fields.email} required>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={(event) => set('email', event.target.value)}
                invalid={Boolean(fields.email)}
                placeholder="vous@exemple.com"
              />
            </Field>

            <Field label={t('auth.password')} htmlFor="password" error={fields.password} required>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={form.password}
                onChange={(event) => set('password', event.target.value)}
                invalid={Boolean(fields.password)}
                placeholder="••••••••"
              />
              {form.password.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${(strength.score / 4) * 100}%`, background: strengthColor }}
                    />
                  </div>
                  <span className="text-[11px]" style={{ color: strengthColor }}>
                    {strengthLabel}
                  </span>
                </div>
              )}
            </Field>

            <Button type="submit" fullWidth size="lg" disabled={!step1Valid}>
              {t('common.next')}
              <Icon name="chevronRight" size={17} className="rtl:rotate-180" />
            </Button>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('auth.city')} htmlFor="city">
                <Input
                  id="city"
                  list="city-suggestions"
                  value={form.city}
                  onChange={(event) => set('city', event.target.value)}
                />
                <datalist id="city-suggestions">
                  {Object.keys(FALLBACK_CITIES).map((city) => (
                    <option key={city} value={city} />
                  ))}
                </datalist>
              </Field>
              <Field label={t('auth.country')} htmlFor="country">
                <Input id="country" value={form.country} onChange={(event) => set('country', event.target.value)} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t('auth.language')} htmlFor="locale">
                <Select id="locale" value={form.locale} onChange={(event) => set('locale', event.target.value as Locale)}>
                  {LOCALES.map((locale) => (
                    <option key={locale} value={locale}>
                      {LOCALE_META[locale].flag} {LOCALE_META[locale].label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('auth.birthDate')} htmlFor="birthDate" hint={t('common.optional')}>
                <Input
                  id="birthDate"
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={form.birthDate}
                  onChange={(event) => set('birthDate', event.target.value)}
                />
              </Field>
            </div>

            <Field label={t('auth.gender')} htmlFor="gender" hint={t('common.optional')}>
              <Select id="gender" value={form.gender} onChange={(event) => set('gender', event.target.value as typeof form.gender)}>
                <option value="">—</option>
                <option value="male">{t('auth.genderMale')}</option>
                <option value="female">{t('auth.genderFemale')}</option>
                <option value="other">{t('auth.genderOther')}</option>
              </Select>
            </Field>

            <Field label={t('auth.mainGoal')} htmlFor="mainGoal" hint={t('common.optional')}>
              <Input
                id="mainGoal"
                value={form.mainGoal}
                onChange={(event) => set('mainGoal', event.target.value)}
                placeholder={t('auth.mainGoalPlaceholder')}
              />
            </Field>

            <Checkbox
              id="acceptTerms"
              checked={form.acceptTerms}
              onChange={(event) => set('acceptTerms', event.target.checked)}
              label={t('auth.acceptTerms')}
            />

            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="lg" onClick={() => setStep(1)}>
                {t('common.back')}
              </Button>
              <Button type="submit" loading={loading} fullWidth size="lg" disabled={!form.acceptTerms}>
                {t('auth.register')}
              </Button>
            </div>
          </>
        )}
      </form>

      <p className="mt-7 text-center text-sm text-[var(--text-muted)]">
        {t('auth.hasAccount')}{' '}
        <Link href="/login" className="font-medium text-[var(--brand-text)] transition-opacity hover:opacity-80">
          {t('auth.login')}
        </Link>
      </p>
    </div>
  );
}
