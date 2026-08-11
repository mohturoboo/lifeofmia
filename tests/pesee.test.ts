import { describe, expect, it } from 'vitest';
import { weightSchema } from '@/lib/validation/modules';
import { formatWeight, formatWeightDelta } from '@/lib/weight';

/**
 * Validation et affichage des pesees.
 *
 * Deux defauts se repondaient : le serveur acceptait ce qu'il n'enregistrait
 * pas, et l'interface ecrivait la meme donnee de deux facons.
 */

const BASE = { date: '2026-08-11', weightKg: 74 };

describe('validation d une pesee', () => {
  it('accepte une saisie complete', () => {
    const resultat = weightSchema.safeParse({ ...BASE, bodyFat: 18.4, muscleKg: 34, note: 'a jeun' });
    expect(resultat.success).toBe(true);
  });

  /*
   * Le defaut : `{"bodyFatPct": 999}` repondait « 201 Created » en stockant
   * `bodyFat: null`. Le nom du champ etait faux ET la valeur hors bornes ;
   * aucun des deux n'etait signale.
   */
  it('refuse un champ inconnu au lieu de l ignorer', () => {
    const resultat = weightSchema.safeParse({ ...BASE, bodyFatPct: 999 });

    expect(resultat.success).toBe(false);
    const message = resultat.error?.issues[0]?.message ?? '';
    expect(message).toContain('bodyFatPct');
  });

  it('refuse un taux de masse grasse hors des bornes 0-100', () => {
    expect(weightSchema.safeParse({ ...BASE, bodyFat: 999 }).success).toBe(false);
    expect(weightSchema.safeParse({ ...BASE, bodyFat: -1 }).success).toBe(false);

    // Les bornes elles-memes restent acceptees.
    expect(weightSchema.safeParse({ ...BASE, bodyFat: 0 }).success).toBe(true);
    expect(weightSchema.safeParse({ ...BASE, bodyFat: 100 }).success).toBe(true);
  });

  it('explique en francais ce qui ne va pas', () => {
    const resultat = weightSchema.safeParse({ ...BASE, bodyFat: 150 });
    expect(resultat.error?.issues[0]?.message).toMatch(/masse grasse.*0 et 100/i);
  });

  it('refuse un poids hors des bornes physiologiques', () => {
    expect(weightSchema.safeParse({ ...BASE, weightKg: 5 }).success).toBe(false);
    expect(weightSchema.safeParse({ ...BASE, weightKg: 900 }).success).toBe(false);
  });
});

describe('formatage d une masse', () => {
  it('separe toujours le nombre de son unite', () => {
    expect(formatWeight(75, 'fr')).toBe('75 kg');
    expect(formatWeight(75, 'en')).toBe('75 kg');
  });

  it('arrondit au dixieme et suit la locale', () => {
    expect(formatWeight(74.26, 'fr')).toBe('74,3 kg');
    expect(formatWeight(74.26, 'en')).toBe('74.3 kg');
  });

  it('signe les ecarts, sauf le zero', () => {
    expect(formatWeightDelta(1.2, 'fr')).toBe('+1,2 kg');
    expect(formatWeightDelta(-1.2, 'fr')).toBe('-1,2 kg');
    // « +0 kg » se lirait comme une hausse.
    expect(formatWeightDelta(0, 'fr')).toBe('0 kg');
  });
});
