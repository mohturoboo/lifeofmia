'use client';

import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ui/icons';

/**
 * En-tete commun a toutes les pages de module : icone coloree, titre,
 * sous-titre et zone d'actions. Homogeneiser cet element evite que chaque
 * module invente sa propre mise en page.
 */
export function PageHeader({
  title,
  subtitle,
  icon,
  color,
  actions,
}: {
  title: string;
  subtitle?: string;
  icon: IconName;
  color: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <span
          className="grid size-11 shrink-0 place-items-center rounded-2xl"
          style={{ background: `${color}1f`, color }}
        >
          <Icon name={icon} size={21} />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-[var(--text-muted)]">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Selecteur de date compact, partage par les modules journaliers. */
export function DateNav({
  date,
  onChange,
  locale,
}: {
  date: string;
  onChange: (date: string) => void;
  locale: string;
}) {
  const shift = (days: number) => {
    const next = new Date(`${date}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + days);
    onChange(next.toISOString().slice(0, 10));
  };

  const label = new Date(`${date}T12:00:00Z`).toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <div className="flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
      <button
        type="button"
        onClick={() => shift(-1)}
        aria-label="Jour precedent"
        className="grid size-11 place-items-center rounded-lg text-[var(--text-muted)] lm-transition-ui hover:bg-[var(--surface-2)]"
      >
        <Icon name="chevronLeft" size={16} className="rtl:rotate-180" />
      </button>
      <span className="min-w-28 px-2 text-center text-[13px] font-medium capitalize text-[var(--text)]">
        {label}
      </span>
      <button
        type="button"
        onClick={() => shift(1)}
        aria-label="Jour suivant"
        className="grid size-11 place-items-center rounded-lg text-[var(--text-muted)] lm-transition-ui hover:bg-[var(--surface-2)]"
      >
        <Icon name="chevronRight" size={16} className="rtl:rotate-180" />
      </button>
    </div>
  );
}
