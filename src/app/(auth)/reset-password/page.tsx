'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState, type FormEvent } from 'react';
import { api, ApiClientError } from '@/lib/client/api';
import { Button, Field, Input } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { evaluatePassword } from '@/lib/auth/password-strength';
import { useT } from '@/i18n/provider';

function ResetForm() {
  const t = useT();
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const strength = useMemo(() => evaluatePassword(password), [password]);
  const colors = ['#ff9fbf', '#ff9fbf', '#ff9fbf', '#fbe3ec', '#fbe3ec'];

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post('/api/auth/reset-password', { token, password });
      setDone(true);
      setTimeout(() => router.push('/login'), 2200);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : t('common.error'));
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="text-center">
        <h1 className="text-xl font-semibold text-[var(--text)]">{t('auth.linkInvalid')}</h1>
        <Link href="/forgot-password" className="mt-5 inline-block text-sm font-medium text-[var(--brand-text)]">
          {t('auth.forgotPassword')}
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#f6d9e4]/12 text-[#f6d9e4]">
          <Icon name="checkCircle" size={24} />
        </span>
        <h1 className="mt-5 text-xl font-semibold text-[var(--text)]">{t('common.success')}</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">{t('auth.login')}...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">{t('auth.resetTitle')}</h1>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        {error && (
          <div role="alert" className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-500">
            {error}
          </div>
        )}

        <Field label={t('auth.newPassword')} htmlFor="password" required>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
          />
          {password.length > 0 && (
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--border)]">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${(strength.score / 4) * 100}%`, background: colors[strength.score] }}
              />
            </div>
          )}
        </Field>

        <Button type="submit" loading={loading} fullWidth size="lg" disabled={strength.score < 2}>
          {t('auth.resetPassword')}
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="lm-skeleton h-64 rounded-2xl" />}>
      <ResetForm />
    </Suspense>
  );
}
