import { describe, expect, it } from 'vitest';
import { calendarEventSchema, calendarEventUpdateSchema } from '@/lib/validation/modules';
import { FIN_AVANT_DEBUT } from '@/lib/validation/common';

/**
 * Coherence temporelle d'un evenement.
 *
 * La route acceptait une fin anterieure au debut, puis imposait une duree
 * d'une heure sans le dire : « 201 Created » pour une donnee que l'appelant
 * n'avait pas demandee. La faute doit se signaler, pas se reparer en douce.
 */

const BASE = {
  title: 'QA Evt',
  startAt: '2026-08-20T10:00:00Z',
  endAt: '2026-08-20T11:00:00Z',
};

describe('evenement de calendrier', () => {
  it('accepte un intervalle de duree positive', () => {
    expect(calendarEventSchema.safeParse(BASE).success).toBe(true);
  });

  it('refuse une fin anterieure au debut', () => {
    const resultat = calendarEventSchema.safeParse({ ...BASE, endAt: '2026-08-20T08:00:00Z' });

    expect(resultat.success).toBe(false);
    const probleme = resultat.error?.issues[0];
    expect(probleme?.message).toBe(FIN_AVANT_DEBUT);
    // Le message doit se poser sous le champ de fin, pas en haut du formulaire.
    expect(probleme?.path).toEqual(['endAt']);
  });

  it('refuse une duree nulle', () => {
    const resultat = calendarEventSchema.safeParse({ ...BASE, endAt: BASE.startAt });
    expect(resultat.success).toBe(false);
    expect(resultat.error?.issues[0]?.message).toBe(FIN_AVANT_DEBUT);
  });

  /*
   * `new Date('demain')` produit `Invalid Date`, que Prisma refusait en bout de
   * chaine par une 500 sans rapport avec la saisie.
   */
  it('refuse une date impossible a interpreter', () => {
    expect(calendarEventSchema.safeParse({ ...BASE, startAt: 'demain' }).success).toBe(false);
    expect(calendarEventSchema.safeParse({ ...BASE, endAt: '2026-13-45T10:00:00Z' }).success).toBe(false);
  });

  it('laisse le schema de modification rester partiel', () => {
    /*
     * La regle croisee ne peut pas vivre dans le schema partiel : deplacer la
     * seule heure de fin n'y fournit pas le debut. Elle est verifiee cote
     * route, apres fusion avec les valeurs enregistrees.
     */
    expect(calendarEventUpdateSchema.safeParse({ endAt: '2026-08-20T08:00:00Z' }).success).toBe(true);
    expect(calendarEventUpdateSchema.safeParse({ title: 'Renomme' }).success).toBe(true);
    // La validite d'une date reste exigee, elle.
    expect(calendarEventUpdateSchema.safeParse({ endAt: 'demain' }).success).toBe(false);
  });
});
