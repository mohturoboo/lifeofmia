import { describe, expect, it } from 'vitest';
import { formatWater } from '@/lib/hydration';

/**
 * Non-regression : un verre de 250 ml s'affichait « 0.3 L ».
 *
 * L'ancien calcul, `(ml / 1000).toFixed(1)`, arrondissait a un dixieme de
 * litre. Le premier verre affichait donc un tiers de litre, et trois verres
 * — 750 ml — devenaient « 0.8 L ». Aucune addition ne tombait juste.
 */
describe('affichage de l\'hydratation', () => {
  it('parle en millilitres sous le litre', () => {
    expect(formatWater(0, 'fr-FR')).toBe('0 ml');
    expect(formatWater(250, 'fr-FR')).toBe('250 ml');
    expect(formatWater(750, 'fr-FR')).toBe('750 ml');
    expect(formatWater(999, 'fr-FR')).toBe('999 ml');
  });

  it('passe au litre au-dela de 1000 ml, sans arrondi trompeur', () => {
    expect(formatWater(1000, 'fr-FR')).toBe('1 L');
    expect(formatWater(1250, 'fr-FR')).toBe('1,25 L');
    expect(formatWater(2000, 'fr-FR')).toBe('2 L');
  });

  it('n\'affiche jamais de volume negatif', () => {
    expect(formatWater(-250, 'fr-FR')).toBe('0 ml');
  });
});
