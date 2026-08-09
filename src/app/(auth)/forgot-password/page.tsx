'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { api } from '@/lib/client/api';
import { Button, Field, Input } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { useT } from '@/i18n/provider';

export default function ForgotPasswordPage() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    // La reponse est volontairement identique en cas de succes ou d'echec :
    // aucune information sur l'existence du compte n'est divulguee.
    await api.post('/api/auth/forgot-password', { email }).catch(() => undefined);
    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#f6d9e4]/12 text-[#f6d9e4]">
          <Icon name="mail" size={24} />
        </span>
        <h1 className="mt-5 text-xl font-semibold text-[var(--text)]">{t('auth.forgotTitle')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{t('auth.forgotSent')}</p>
        <Link
          href="/login"
          className="mt-7 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand-text)] transition-opacity hover:opacity-80"
        >
          <Icon name="chevronLeft" size={15} className="rtl:rotate-180" />
          {t('auth.login')}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">{t('auth.forgotTitle')}</h1>
      <p className="mt-1.5 text-sm text-[var(--text-muted)]">{t('auth.forgotSubtitle')}</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <Field label={t('auth.email')} htmlFor="email" required>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="vous@exemple.com"
          />
        </Field>

        <Button type="submit" loading={loading} fullWidth size="lg">
          {t('auth.resetPassword')}
        </Button>
      </form>

      <Link
        href="/login"
        className="mt-7 flex items-center justify-center gap-1.5 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
      >
        <Icon name="chevronLeft" size={15} className="rtl:rotate-180" />
        {t('common.back')}
      </Link>
    </div>
  );
}
