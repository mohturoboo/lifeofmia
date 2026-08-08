'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { api } from '@/lib/client/api';
import { Icon } from '@/components/ui/icons';
import { useT } from '@/i18n/provider';

function VerifyContent() {
  const t = useT();
  const token = useSearchParams().get('token') ?? '';
  const [state, setState] = useState<'pending' | 'success' | 'error'>('pending');

  useEffect(() => {
    if (!token) {
      setState('error');
      return;
    }
    api
      .post('/api/auth/verify-email', { token })
      .then(() => setState('success'))
      .catch(() => setState('error'));
  }, [token]);

  const view = {
    pending: { icon: 'clock' as const, color: '#8592ad', title: t('auth.verifyEmail'), text: t('common.loading') },
    success: { icon: 'checkCircle' as const, color: '#7ba083', title: t('auth.verifySuccess'), text: '' },
    error: { icon: 'close' as const, color: '#c97f63', title: t('auth.verifyError'), text: '' },
  }[state];

  return (
    <div className="text-center">
      <span
        className="mx-auto grid size-14 place-items-center rounded-2xl"
        style={{ background: `${view.color}1f`, color: view.color }}
      >
        <Icon name={view.icon} size={24} />
      </span>
      <h1 className="mt-5 text-xl font-semibold text-[var(--text)]">{view.title}</h1>
      {view.text && <p className="mt-2 text-sm text-[var(--text-muted)]">{view.text}</p>}

      {state !== 'pending' && (
        <Link
          href={state === 'success' ? '/dashboard' : '/login'}
          className="mt-7 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand-text)] transition-opacity hover:opacity-80"
        >
          {state === 'success' ? t('nav.dashboard') : t('auth.login')}
          <Icon name="chevronRight" size={15} className="rtl:rotate-180" />
        </Link>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="lm-skeleton h-48 rounded-2xl" />}>
      <VerifyContent />
    </Suspense>
  );
}
