'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { api, ApiClientError } from '@/lib/client/api';
import { Button, Field, Input } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { useT } from '@/i18n/provider';

function LoginForm() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setFields({});

    try {
      await api.post('/api/auth/login', { email, password });
      // `refresh()` avant `push()` : la mise en page racine relit la session et
      // applique immediatement la langue et le theme du compte.
      router.refresh();
      router.push(searchParams.get('next') ?? '/dashboard');
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        setError(caught.message);
        setFields(caught.fields ?? {});
      } else {
        setError(t('common.error'));
      }
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">{t('auth.loginTitle')}</h1>
      <p className="mt-1.5 text-sm text-[var(--text-muted)]">{t('auth.loginSubtitle')}</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        {error && (
          <div role="alert" className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-500">
            {error}
          </div>
        )}

        <Field label={t('auth.email')} htmlFor="email" error={fields.email} required>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            invalid={Boolean(fields.email)}
            placeholder="vous@exemple.com"
          />
        </Field>

        <Field label={t('auth.password')} htmlFor="password" error={fields.password} required>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              invalid={Boolean(fields.password)}
              className="pe-11"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              className="absolute inset-y-0 end-0 grid w-11 place-items-center text-[var(--text-faint)] transition-colors hover:text-[var(--text)]"
            >
              <Icon name={showPassword ? 'eyeOff' : 'eye'} size={17} />
            </button>
          </div>
        </Field>

        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-[13px] text-[var(--brand-text)] transition-opacity hover:opacity-80">
            {t('auth.forgotPassword')}
          </Link>
        </div>

        <Button type="submit" loading={loading} fullWidth size="lg">
          {t('auth.login')}
        </Button>
      </form>

      <p className="mt-7 text-center text-sm text-[var(--text-muted)]">
        {t('auth.noAccount')}{' '}
        <Link href="/register" className="font-medium text-[var(--brand-text)] transition-opacity hover:opacity-80">
          {t('auth.register')}
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="lm-skeleton h-80 rounded-2xl" />}>
      <LoginForm />
    </Suspense>
  );
}
