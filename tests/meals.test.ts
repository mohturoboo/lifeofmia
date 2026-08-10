/**
 * Repas : la case « Enregistrer comme modele » ne doit jamais faire sortir un
 * repas de sa journee.
 *
 * Le formulaire pilotait `isTemplate`, qui decrit la nature de la ligne. Cocher
 * la case transformait donc le repas en modele : il disparaissait de la liste
 * du jour et le total de calories retombait a zero. L'intention « enregistrer
 * aussi un modele » porte desormais son propre champ, `saveAsTemplate`.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import * as modules from '@/lib/validation/modules';
import { mealCreateSchema, mealUpdateSchema } from '@/lib/validation/modules';

const BASE = {
  date: '2026-08-09',
  type: 'lunch' as const,
  name: 'Poulet riz',
  calories: 600,
};

describe('creation d\'un repas', () => {
  it('n\'enregistre pas de modele si la case n\'est pas cochee', () => {
    const parsed = mealCreateSchema.parse(BASE);
    expect(parsed.saveAsTemplate).toBe(false);
    expect(parsed.isTemplate).toBe(false);
  });

  it('accepte la demande de modele sans changer la nature du repas', () => {
    const parsed = mealCreateSchema.parse({ ...BASE, saveAsTemplate: true });
    expect(parsed.saveAsTemplate).toBe(true);
    // Le repas reste un repas : c'est une copie separee qui devient le modele.
    expect(parsed.isTemplate).toBe(false);
  });

  it('conserve isTemplate pour creer un modele pur', () => {
    const parsed = mealCreateSchema.parse({ ...BASE, isTemplate: true });
    expect(parsed.isTemplate).toBe(true);
  });
});

describe('modification d\'un repas', () => {
  it('ignore isTemplate, meme envoye explicitement', () => {
    const parsed = mealUpdateSchema.parse({ calories: 450, isTemplate: true });
    expect(parsed).not.toHaveProperty('isTemplate');
    expect(parsed.calories).toBe(450);
  });

  it('laisse passer la demande de modele', () => {
    const parsed = mealUpdateSchema.parse({ name: 'Poulet riz complet', saveAsTemplate: true });
    expect(parsed.saveAsTemplate).toBe(true);
  });

  it('ne touche a rien d\'autre que le champ envoye', () => {
    // Avant correction : protein, carbs, fat, fiber, quantity et unit
    // repartaient a leur valeur par defaut a chaque modification.
    expect(mealUpdateSchema.parse({ calories: 120 })).toEqual({ calories: 120 });
  });

  it('refuse un nom vide', () => {
    expect(() => mealUpdateSchema.parse({ name: '   ' })).toThrow();
  });
});

/**
 * Le piege n'etait pas propre aux repas : `.partial()` laisse survivre les
 * valeurs par defaut, donc TOUT schema de mise a jour construit ainsi reecrit
 * les champs absents. Renommer une habitude reinitialisait sa couleur, sa
 * frequence et ses jours ; epingler une note effacait son contenu.
 */
describe('mises a jour partielles — tous les modules', () => {
  // Le module exporte aussi des listes de constantes : on ne garde que les schemas.
  const schemas = (Object.entries(modules) as Array<[string, unknown]>).filter(
    (entry): entry is [string, z.ZodObject] =>
      entry[0].endsWith('UpdateSchema') && entry[1] instanceof z.ZodObject,
  );

  it('couvre bien tous les schemas de mise a jour', () => {
    expect(schemas.length).toBeGreaterThanOrEqual(9);
  });

  it.each(schemas)('%s ne reecrit aucun champ absent', (_nom, schema) => {
    expect(schema.parse({})).toEqual({});
  });
});
