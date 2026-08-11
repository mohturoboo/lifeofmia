// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { BarChart, LineChart } from '@/components/charts';

/**
 * Echelles et etats vides des graphiques.
 *
 * Deux defauts visibles simultanement a l'ecran :
 *  - l'axe vertical du score de discipline descendait sous zero (-4,1) parce
 *    que l'echelle automatique ajoute 15 % de marge de part et d'autre, sans
 *    savoir que la grandeur tracee est bornee a [0, 100] ;
 *  - une semaine entierement a zero produisait un histogramme sans aucune
 *    barre, indiscernable d'un graphique casse.
 */

afterEach(cleanup);

const SEMAINE = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Graduations lues sur l'axe vertical (les libelles de l'axe des x sont exclus). */
function graduations(container: HTMLElement): number[] {
  return Array.from(container.querySelectorAll('text'))
    .filter((node) => node.getAttribute('text-anchor') === 'end')
    .map((node) => Number(node.textContent))
    .filter((value) => Number.isFinite(value));
}

describe('LineChart — domaine impose', () => {
  it('n affiche aucune graduation negative pour un score borne a [0, 100]', () => {
    const { container } = render(
      <LineChart
        data={SEMAINE.map((label, index) => ({ label, value: [0, 12, 27, 5, 0, 18, 22][index] }))}
        domain={[0, 100]}
        unit="%"
      />,
    );

    const ticks = graduations(container);
    expect(ticks.length).toBeGreaterThan(0);
    expect(Math.min(...ticks)).toBe(0);
    expect(Math.max(...ticks)).toBe(100);
    expect(ticks.every((value) => Number.isInteger(value))).toBe(true);
  });

  it('sans domaine impose, ne descend pas sous zero sur une serie positive', () => {
    const { container } = render(
      <LineChart data={SEMAINE.map((label, index) => ({ label, value: [0, 12, 27, 5, 0, 18, 22][index] }))} />,
    );

    expect(graduations(container).every((value) => value >= 0)).toBe(true);
  });

  it('conserve une echelle utile sur une serie qui ne part pas de zero', () => {
    const { container } = render(
      <LineChart data={[68.2, 68.0, 67.6, 67.9].map((value, index) => ({ label: `J${index}`, value }))} unit=" kg" />,
    );

    // Un poids ne doit pas se retrouver ecrase sur un axe partant de zero.
    expect(Math.min(...graduations(container))).toBeGreaterThan(60);
  });
});

describe('BarChart — lisibilite', () => {
  it('etire les colonnes sur toute la hauteur du graphique', () => {
    const { container } = render(
      <BarChart data={SEMAINE.map((label, index) => ({ label, value: [0, 12, 27, 5, 0, 18, 22][index] }))} maxValue={100} />,
    );

    const root = container.firstElementChild as HTMLElement;
    /*
     * `items-end` alignait les colonnes en bas SANS les etirer : elles
     * prenaient la hauteur de leur libelle, la zone de barre mesurait 0 px, et
     * les hauteurs exprimees en pourcentage de cette zone valaient zero. Aucune
     * barre n'etait dessinee, quelles que soient les valeurs.
     */
    expect(root.className).not.toContain('items-end');
  });

  it('donne une hauteur non nulle a une valeur nulle', () => {
    const { container } = render(
      <BarChart data={SEMAINE.map((label, index) => ({ label, value: [0, 12, 27, 5, 0, 18, 22][index] }))} maxValue={100} />,
    );

    const hauteurs = Array.from(container.querySelectorAll<HTMLElement>('[style*="height"]'))
      .filter((node) => node.style.height.endsWith('%'))
      .map((node) => Number.parseFloat(node.style.height));

    expect(hauteurs).toHaveLength(SEMAINE.length);
    expect(Math.min(...hauteurs)).toBeGreaterThan(0);
    // La proportion reste juste : 27 % de l'echelle vaut bien 27 % de hauteur.
    expect(Math.max(...hauteurs)).toBe(27);
  });

  it('affiche un etat vide explicite quand toute la serie est a zero', () => {
    render(
      <BarChart
        data={SEMAINE.map((label) => ({ label, value: 0 }))}
        maxValue={100}
        emptyLabel="Rien a afficher pour le moment"
      />,
    );

    expect(screen.getByText('Rien a afficher pour le moment')).toBeTruthy();
  });
});
