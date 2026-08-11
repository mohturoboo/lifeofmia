'use client';

import { useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePiegeFocus } from '@/lib/client/piege-focus';
import { cx, IconButton } from '@/components/ui/primitives';

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
  /**
   * Soumission du formulaire contenu dans la fenetre.
   *
   * Fournie, elle enveloppe le contenu ET le pied dans un `<form>` : la touche
   * Entree valide alors la saisie, comme dans n'importe quel formulaire. Sans
   * elle, il fallait viser le bouton a la souris.
   */
  onSubmit?: () => void;
}

const SIZES = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' } as const;

export function Modal({ open, onClose, title, description, children, footer, size = 'md', onSubmit }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  /*
   * Echap, piege a focus, restitution du focus au declencheur et blocage du
   * defilement sont mutualises avec le tiroir de navigation.
   *
   * Ces regles etaient ecrites ici, et nulle part ailleurs : le tiroir mobile
   * s'ouvrait donc par-dessus la page sans rien confiner. Une regle ecrite
   * deux fois finit toujours par ne valoir qu'a un seul endroit ; celle-ci
   * n'existait qu'a moitie.
   */
  usePiegeFocus(open, panelRef, onClose, { prioriteAuxChamps: true });

  if (!open || typeof document === 'undefined') return null;

  /*
   * Rendu dans `document.body`, pas a l'endroit de l'appel.
   *
   * La colonne de contenu de l'application est un contexte d'empilement
   * (`position: relative; z-index: 10`). Une fenetre rendue a l'interieur ne
   * pouvait donc jamais passer devant la barre de navigation basse, restee
   * dehors en `z-index: 30` : quel que soit son propre rang, elle etait peinte
   * avec toute la colonne, en dessous. Sur mobile, le bouton « Enregistrer »
   * tombait derriere la barre et devenait inatteignable.
   *
   * Le portail sort la fenetre de ce contexte ; les rangs nommes rendent
   * l'ordre explicite : navigation 30, voile 40, panneau 50.
   */
  return createPortal(
    <div
      className="fixed inset-0 flex items-end justify-center p-0 sm:items-center sm:p-4"
      style={{ zIndex: 'var(--z-overlay)' }}
    >
      <div
        onClick={onClose}
        className="lm-modal-overlay absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-hidden="true"
      />
      {/*
        Rang explicite : le voile applique un `backdrop-filter`, qui cree son
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
        style={{ zIndex: 'var(--z-dialog)' }}
        className={cx(
          'lm-modal-panel relative flex max-h-[92vh] w-full flex-col overflow-hidden bg-[var(--surface)]',
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
          <IconButton icon="close" label="Fermer" size={17} onClick={onClose} />
        </header>

        {onSubmit ? (
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
            }}
          >
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer && (
              <footer className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-3.5">{footer}</footer>
            )}
          </form>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer && (
              <footer className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-3.5">{footer}</footer>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
