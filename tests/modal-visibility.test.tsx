// @vitest-environment jsdom
import { describe, expect, it, afterEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
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

  it('n\'anime jamais l\'opacite du panneau', async () => {
    // Une animation figee maintient son image de depart. Animer l'opacite
    // depuis 0 rendrait donc l'affichage tributaire de son bon deroulement.
    const css = await readFile(resolve(process.cwd(), 'src/app/globals.css'), 'utf8');
    const keyframes = css.slice(css.indexOf('@keyframes lm-modal-in'));
    const bloc = keyframes.slice(0, keyframes.indexOf('}', keyframes.indexOf('}') + 1) + 1);

    expect(bloc).toContain('transform');
    expect(bloc).not.toContain('opacity');
  });

  it('place le panneau au-dessus du voile assombri', () => {
    ouvrir();
    // La fenetre est rendue dans `document.body` par un portail : elle n'est
    // plus dans le conteneur retourne par `render`.
    const voile = document.body.querySelector('[aria-hidden="true"]');
    const panneau = screen.getByRole('dialog');

    expect(voile).toBeTruthy();
    expect(panneau.style.zIndex).toBe('var(--z-dialog)');
  });

  it('sort de la colonne de contenu pour ne pas passer sous la navigation', () => {
    // Rendue a l'endroit de l'appel, la fenetre restait prisonniere du contexte
    // d'empilement de la colonne et passait sous la barre de navigation basse.
    const { container } = ouvrir();

    expect(container.querySelector('[role="dialog"]'), 'la fenetre ne doit pas etre rendue sur place').toBeNull();
    expect(document.body.querySelector('[role="dialog"]')).toBeTruthy();
    expect(document.body.dataset.dialogOpen).toBe('true');
  });

  it('place le focus sans attendre la moindre image d\'animation', () => {
    // Le placement passait par requestAnimationFrame. Tout ce que l'utilisateur
    // tapait avant cette image partait vers le bouton qui venait d'ouvrir la
    // fenetre, et etait perdu sans le moindre signe.
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);

    render(
      <Modal open onClose={() => {}} title="Enregistrer mon poids">
        <input aria-label="Poids" />
        <input aria-label="Note" />
      </Modal>,
    );

    expect(document.activeElement).toBe(screen.getByLabelText('Poids'));
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
