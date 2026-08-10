// @vitest-environment jsdom
import { describe, expect, it, afterEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Modal } from '@/components/ui/modal';

/**
 * Non-regression : fenetre modale presente mais invisible.
 *
 * Le panneau etait anime par framer-motion, dont l'etat de depart est
 * `opacity: 0` pose en style en ligne. Sa visibilite dependait donc de la bonne
 * execution de la boucle d'animation. Quand celle-ci ne tournait pas — onglet
 * en arriere-plan a l'ouverture, images throttlees par le navigateur —, le
 * formulaire restait a `opacity: 0` : present dans le DOM, focusable au
 * clavier, mais jamais peint. Creer une habitude ou un objectif devenait
 * impossible a la souris.
 *
 * Ces tests verrouillent l'inverse : au repos, la fenetre est VISIBLE. Toute
 * animation n'est qu'un supplement, jamais une condition d'affichage.
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function ouvrir() {
  return render(
    <Modal open onClose={() => {}} title="Nouvelle habitude" footer={<button type="button">Enregistrer</button>}>
      <input aria-label="Nom" />
    </Modal>,
  );
}

describe('Modal — visible sans animation', () => {
  it('s\'affiche meme si aucune image d\'animation n\'est jamais rendue', () => {
    // Reproduit un onglet en arriere-plan : requestAnimationFrame ne rappelle jamais.
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);

    ouvrir();

    const dialogue = screen.getByRole('dialog');
    expect(dialogue).toBeTruthy();
    expect(screen.getByText('Nouvelle habitude')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeTruthy();
  });

  it('ne pose aucun style en ligne qui masquerait le panneau', () => {
    ouvrir();
    const style = screen.getByRole('dialog').style;

    // Ce sont exactement les proprietes que la bibliotheque d'animation posait.
    expect(style.opacity).toBe('');
    expect(style.transform).toBe('');
    expect(style.visibility).toBe('');
    expect(style.display).toBe('');
  });

  it('place le panneau au-dessus du voile assombri', () => {
    const { container } = ouvrir();
    const voile = container.querySelector('[aria-hidden="true"]');
    const panneau = screen.getByRole('dialog');

    // Le voile applique un `backdrop-filter` : sans rang explicite, le panneau
    // ne devait son passage au premier plan qu'a l'ordre du DOM.
    expect(voile).toBeTruthy();
    expect(panneau.className).toContain('z-10');
  });

  it('disparait immediatement a la fermeture', () => {
    const { rerender } = ouvrir();
    expect(screen.queryByRole('dialog')).toBeTruthy();

    rerender(
      <Modal open={false} onClose={() => {}} title="Nouvelle habitude">
        <input aria-label="Nom" />
      </Modal>,
    );

    // Le retrait ne depend plus d'une animation de sortie : sans boucle
    // d'animation, l'ancienne version laissait le panneau monte indefiniment.
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
