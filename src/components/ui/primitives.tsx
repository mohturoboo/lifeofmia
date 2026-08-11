'use client';

import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Icon, type IconName } from '@/components/ui/icons';

/**
 * Primitives d'interface.
 *
 * Volontairement peu nombreuses et sans dependance : chaque composant est
 * accessible par defaut (label associe, `aria-invalid`, message d'erreur lie
 * par `aria-describedby`, cible tactile d'au moins 40 px).
 */

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

// --- Bouton ------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
type ButtonSize = 'sm' | 'md' | 'lg';

/*
 * Le bouton principal est une pastille rose bebe a encre noire, entouree d'une
 * lueur rose. Sur un rose aussi clair, un libelle blanc serait illisible :
 * l'encre noire donne 13,5:1 et renforce l'effet « pastille lumineuse ».
 * `lm-sweep` fait passer une bande de lumiere au survol.
 */
const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'lm-gradient-bg lm-sweep lm-glow text-[var(--on-pink)] hover:brightness-[1.04] active:scale-[0.985]',
  secondary:
    'bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] hover:border-brand-300/40 hover:bg-[var(--surface-hover)]',
  ghost: 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]',
  subtle:
    'bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] hover:border-brand-300/40',
  danger: 'bg-[#ff9fbf]/10 text-[#ff9fbf] border border-[#ff9fbf]/25 hover:bg-[#ff9fbf]/20',
};

/* Pastilles franchement arrondies, interlettrage ouvert. */
const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-[12.5px] tracking-[0.03em] gap-1.5 rounded-full',
  md: 'h-11 px-6 text-[13.5px] tracking-[0.03em] gap-2 rounded-full',
  lg: 'h-13 px-8 text-[14.5px] tracking-[0.04em] gap-2.5 rounded-full',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon, loading, fullWidth, className, children, disabled, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      /*
       * `type="button"` par defaut. En HTML, un bouton sans type vaut
       * `submit` : place dans un formulaire, « Annuler » l'envoyait au lieu de
       * le fermer. Les boutons qui soumettent le declarent, c'est plus sur que
       * l'inverse.
       */
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        /*
         * Transitions ciblees, jamais `transition-all`.
         *
         * `transition-all` inclut l'opacite, et l'opacite de ce bouton change
         * avec son etat `disabled`. Le passage de desactive a actif devient
         * alors une transition de 0,5 vers 1 — une animation de plus, qui peut
         * se retrouver orpheline et figer le bouton sur sa valeur de DEPART.
         * Il reste alors gris alors qu'il est parfaitement fonctionnel : rien
         * n'est plus dissuasif qu'un bouton qui a l'air mort.
         *
         * L'opacite est donc exclue de la liste : elle bascule d'un coup, ce
         * qui est le comportement attendu d'un changement d'etat.
         */
        'inline-flex items-center justify-center font-medium select-none whitespace-nowrap',
        'lm-transition-ui duration-150',
        'disabled:opacity-50 disabled:pointer-events-none',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading ? (
        <span
          className="size-4 rounded-full border-2 border-current border-t-transparent animate-spin"
          aria-hidden="true"
        />
      ) : (
        icon && <Icon name={icon} size={size === 'sm' ? 15 : 17} />
      )}
      {children}
    </button>
  );
});

// --- Champs de formulaire ----------------------------------------------------

export interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

/** Enveloppe commune : label, aide contextuelle et message d'erreur. */
export function Field({ label, hint, error, required, htmlFor, children, className }: FieldProps) {
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-[var(--text-muted)]">
          {label}
          {required && <span className="text-[var(--brand-text)] ms-0.5">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} role="alert" className="text-xs text-red-500">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-[var(--text-faint)]">{hint}</p>
      )}
    </div>
  );
}

const CONTROL_BASE =
  'w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 text-sm text-[var(--text)] ' +
  'placeholder:text-[var(--text-faint)] ' +
  // Meme regle que le bouton : l'opacite change avec `disabled`, elle
  // ne doit pas etre animee.
  'lm-transition-ui duration-200 ' +
  // Au focus, le champ s'entoure d'un halo rose plutot que d'un simple liseret.
  'focus:outline-none focus:border-brand-300/60 focus:ring-4 focus:ring-[var(--ring)] focus:bg-[var(--surface-hover)] ' +
  'disabled:opacity-50 aria-[invalid=true]:border-[#ff9fbf]/60';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, id, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      id={id}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid && id ? `${id}-error` : undefined}
      className={cx(CONTROL_BASE, 'h-11', className)}
      {...props}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cx(CONTROL_BASE, 'py-2.5 min-h-24 resize-y', className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cx(CONTROL_BASE, 'h-11 pe-9 appearance-none cursor-pointer', className)} {...props}>
        {children}
      </select>
    );
  },
);

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
}

export function Checkbox({ label, className, id, ...props }: CheckboxProps) {
  return (
    <label htmlFor={id} className={cx('flex items-start gap-2.5 cursor-pointer group', className)}>
      <input
        type="checkbox"
        id={id}
        className="mt-0.5 size-[18px] shrink-0 rounded-md border border-[var(--border-strong)] bg-[var(--surface-2)] accent-brand-500 cursor-pointer"
        {...props}
      />
      <span className="text-[13px] leading-relaxed text-[var(--text-muted)] group-hover:text-[var(--text)] transition-colors">
        {label}
      </span>
    </label>
  );
}

/** Interrupteur accessible (role=switch) pour les preferences booleennes. */
export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-sm text-[var(--text)]">{label}</p>
        {description && <p className="text-xs text-[var(--text-faint)] mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200',
          checked ? 'lm-gradient-bg' : 'bg-[var(--border-strong)]',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 size-5 rounded-full bg-[var(--surface)] shadow transition-transform duration-200',
            checked ? 'translate-x-[22px] rtl:-translate-x-[22px]' : 'translate-x-0.5 rtl:-translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

// --- Conteneurs --------------------------------------------------------------

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  /*
   * La marge interieure s'allege sur petit ecran. A 320 px, trois tuiles de
   * synthese cote a cote font 91 px chacune : avec 24 px de marge de chaque
   * cote il ne restait que 43 px de texte, et un mot comme « Depenses » (46 px)
   * se retrouvait coupe.
   */
  return <div className={cx('lm-card', padded && 'p-4 sm:p-6', className)}>{children}</div>;
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
  accent,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: IconName;
  accent?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <span
            className="grid size-10 shrink-0 place-items-center rounded-2xl ring-1 ring-inset"
            style={{
              background: `${accent ?? '#fbc7da'}16`,
              color: accent ?? '#fbc7da',
              borderColor: 'transparent',
              // La lueur reprend la teinte du module : chaque section garde son
              // identite sans introduire de couleur supplementaire.
              boxShadow: `0 0 24px -10px ${accent ?? '#fbc7da'}`,
            }}
          >
            <Icon name={icon} size={19} />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-[var(--text)] truncate">{title}</h2>
          {subtitle && <p className="text-xs text-[var(--text-faint)] truncate">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function Badge({
  children,
  color = 'var(--text-muted)',
  className,
}: {
  children: ReactNode;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium', className)}
      style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
    >
      {children}
    </span>
  );
}

/** Barre de progression accessible. */
export function Progress({
  value,
  max = 100,
  color = 'var(--color-brand-500)',
  height = 8,
  label,
}: {
  value: number;
  max?: number;
  color?: string;
  height?: number;
  label?: string;
}) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="w-full overflow-hidden rounded-full bg-[var(--surface-2)]"
      style={{ height }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${percent}%`, background: color }}
      />
    </div>
  );
}

/** Etat vide illustre, utilise par tous les modules. */
export function EmptyState({
  icon = 'sparkles',
  title,
  hint,
  action,
}: {
  icon?: IconName;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span className="grid size-16 place-items-center rounded-3xl bg-brand-300/10 text-brand-300 ring-1 ring-brand-300/20">
        <Icon name={icon} size={26} />
      </span>
      <p className="text-sm font-medium text-[var(--text)]">{title}</p>
      {hint && <p className="max-w-sm text-xs text-[var(--text-faint)]">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('lm-skeleton', className)} aria-hidden="true" />;
}
