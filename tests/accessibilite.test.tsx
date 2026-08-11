// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { IconButton } from '@/components/ui/primitives';
import { HABIT_ICONS } from '@/components/ui/icons';

afterEach(cleanup);

/**
 * Regles d'accessibilite verifiables sans navigateur.
 *
 * Ce qui releve de la mise en page reelle — la taille effective d'une cible en
 * pixels, le piege a focus d'un tiroir — est verifie de bout en bout ; jsdom ne
 * calcule aucune mise en page et validerait n'importe quoi.
 */

describe('bouton-icone', () => {
  it('porte un nom accessible', () => {
    render(<IconButton icon="trash" label="Supprimer la note" />);
    expect(screen.getByRole('button', { name: 'Supprimer la note' })).toBeTruthy();
  });

  it('declare une cible de 44 px, distincte du disque visible', () => {
    const { container } = render(<IconButton icon="edit" label="Modifier" />);
    const bouton = container.querySelector('button')!;

    /*
     * 44 px est le minimum recommande pour un doigt ; les commandes de cartes
     * en mesuraient 28. La cible est le bouton LUI-MEME et non un
     * pseudo-element : trois commandes voisines espacees de 2 px auraient vu
     * leurs zones se chevaucher, et la derniere dessinee aurait vole les clics
     * des precedentes.
     */
    expect(bouton.className).toContain('size-11');

    // Le disque colore, lui, reste a 28 px pour ne pas alourdir les cartes.
    expect(bouton.querySelector('span')?.className).toContain('size-7');
  });

  it('reste discret au repos uniquement quand on le demande', () => {
    const { container: sansOption } = render(<IconButton icon="edit" label="Modifier" />);
    expect(sansOption.querySelector('button')!.className).not.toContain('lm-commande-discrete');

    const { container: avecOption } = render(<IconButton icon="edit" label="Modifier" discret />);
    expect(avecOption.querySelector('button')!.className).toContain('lm-commande-discrete');
  });

  it('est de type button, jamais submit par defaut', () => {
    const { container } = render(<IconButton icon="trash" label="Supprimer" />);
    expect(container.querySelector('button')!.getAttribute('type')).toBe('button');
  });
});

describe('semantique des pictogrammes', () => {
  it("n'ouvre pas la liste des habitudes par une coche", async () => {
    /*
     * La coche est deja le signe de l'etat « accompli » : une habitude qui la
     * portait comme icone paraissait validee en permanence.
     */
    expect(HABIT_ICONS[0]).not.toBe('check');
    // Elle reste proposee, simplement plus en premier.
    expect(HABIT_ICONS).toContain('check');
  });

  it('dispose d une icone d archive distincte du telechargement', async () => {
    const source = await readFile(resolve(process.cwd(), 'src/components/ui/icons.tsx'), 'utf8');

    expect(source).toMatch(/^\s{2}archive:/m);

    const chemin = (nom: string) => new RegExp(`^\\s{2}${nom}: '([^']+)'`, 'm').exec(source)?.[1];
    expect(chemin('archive')).toBeTruthy();
    // « Archiver » empruntait le pictogramme de telechargement : le sens
    // annonce etait l'inverse de l'action.
    expect(chemin('archive')).not.toBe(chemin('download'));
  });

  it("l'action Archiver n'utilise plus le pictogramme de telechargement", async () => {
    const page = await readFile(resolve(process.cwd(), 'src/app/(app)/habits/page.tsx'), 'utf8');
    expect(page).toContain('icon="archive"');
    expect(page).not.toContain('name="download"');
  });
});

describe('regle CSS des commandes secondaires', () => {
  it('ne les efface que la ou le survol existe reellement', async () => {
    const css = await readFile(resolve(process.cwd(), 'src/app/globals.css'), 'utf8');

    const bloc = /@media \(hover: hover\) and \(pointer: fine\) \{([\s\S]*?)\n  \}/.exec(css)?.[1] ?? '';

    /*
     * Sur un ecran tactile, le survol N'EXISTE PAS : la commande n'apparaissait
     * jamais, donc modifier ou supprimer une carte depuis un telephone etait
     * impossible. L'effacement au repos doit donc etre enferme dans cette
     * requete de media, et nulle part ailleurs.
     */
    expect(bloc).toContain('.lm-commande-discrete');
    expect(bloc).toContain('opacity: 0');
    expect(bloc).toContain(':focus-within');
    expect(bloc).toContain(':focus-visible');

    const horsMedia = css.replace(/@media \(hover: hover\)[\s\S]*?\n  \}\n/, '');
    expect(horsMedia).not.toMatch(/\.lm-commande-discrete\s*\{\s*opacity:\s*0/);
  });
});
