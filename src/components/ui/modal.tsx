'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from '@/components/ui/icons';
import { cx } from '@/components/ui/primitives';

/**
 * Fenetre modale accessible.
 *
 * - `role="dialog"` + `aria-modal` ;
 * - fermeture par Echap et par clic sur l'arriere-plan ;
 * - focus place a l'ouverture et piege dans la boite tant qu'elle est ouverte ;
 * - defilement de la page bloque pendant l'affichage.
 */

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' } as const;

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  /*
   * `onClose` est conserve dans une ref plutot que lu directement dans l'effet.
   *
   * Les appelants passent naturellement une fonction en ligne
   * (`onClose={() => setOpen(false)}`) : son identite change a CHAQUE rendu.
   * Si l'effet ci-dessous en dependait, la moindre frappe au clavier
   * declencherait son nettoyage puis sa reexecution — donc un `focus()` force
   * sur le premier champ du formulaire. L'utilisateur perdait le curseur apres
   * chaque caractere des qu'il ecrivait ailleurs que dans le premier champ.
   *
   * La ref donne au gestionnaire clavier un acces toujours a jour a `onClose`
   * sans lier le cycle de vie de l'effet a son identite.
   */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Effet de montage : ne depend QUE de `open`, jamais d'une prop instable.
  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const focusable = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => !element.hasAttribute('disabled'));

    /*
     * A l'ouverture, le focus va au premier CHAMP de saisie, pas au premier
     * element focusable — qui est le bouton de fermeture, place avant le
     * contenu dans le DOM. Sans cette distinction, le `autoFocus` pose par les
     * formulaires sur leur premier champ etait systematiquement ecrase, et
     * l'utilisateur devait cliquer avant de pouvoir ecrire.
     */
    const frame = requestAnimationFrame(() => {
      const elements = focusable();
      const firstField = elements.find((element) =>
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName),
      );
      (firstField ?? elements[0] ?? panelRef.current)?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const elements = focusable();
      if (elements.length === 0) return;
      const first = elements[0];
      const last = elements[elements.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      // La frame est annulee : sans cela, une fermeture immediate laisserait un
      // `focus()` differe s'executer sur un panneau deja demonte.
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        onClick={onClose}
        className="lm-modal-overlay absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-hidden="true"
      />
      {/*
        `z-10` explicite : le voile applique un `backdrop-filter`, qui cree son
        propre contexte d'empilement. Sans rang declare, le panneau dependait de
        l'ordre du DOM pour passer devant — une garantie trop fragile pour la
        seule chose qui rend la fonctionnalite utilisable.
      */}
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lm-modal-title"
        aria-describedby={description ? 'lm-modal-description' : undefined}
        className={cx(
          'lm-modal-panel relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden bg-[var(--surface)]',
          'rounded-t-3xl border border-[var(--border)] shadow-2xl sm:rounded-3xl',
          SIZES[size],
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-0">
            <h2 id="lm-modal-title" className="text-base font-semibold text-[var(--text)]">
              {title}
            </h2>
            {description && (
              <p id="lm-modal-description" className="mt-0.5 text-xs text-[var(--text-faint)]">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-[var(--text-faint)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          >
            <Icon name="close" size={17} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <footer className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-3.5">{footer}</footer>
        )}
      </div>
    </div>
  );
}
