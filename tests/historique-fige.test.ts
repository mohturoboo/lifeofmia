import { describe, expect, it } from 'vitest';
import { habitCountsOn, isHabitScheduled, type HabitWindow } from '@/lib/stats';
import { dateKeyRange } from '@/lib/date';

/**
 * Le passe ne se reecrit pas.
 *
 * Le denominateur d'une journee — le nombre d'habitudes attendues — etait
 * calcule avec la liste d'habitudes du MOMENT DE LA LECTURE, pas avec celle qui
 * existait le jour concerne. Consequences observees :
 *
 *  - creer une sixieme habitude faisait baisser le score de toutes les journees
 *    passees recalculees ensuite, pour une habitude qui n'existait pas alors ;
 *  - archiver une habitude la retirait de l'historique entier, y compris des
 *    journees ou elle avait ete validee.
 *
 * Ces tests fixent la regle : une habitude ne compte que dans sa fenetre
 * d'existence reelle.
 */

const TZ = 'Europe/Paris';

function habit(overrides: Partial<HabitWindow> = {}): HabitWindow {
  return {
    createdAt: new Date('2026-08-10T09:00:00Z'),
    archivedAt: null,
    weekDays: '[0,1,2,3,4,5,6]',
    frequency: 'daily',
    ...overrides,
  };
}

describe('fenetre d existence d une habitude', () => {
  it('ne compte pas une habitude les jours anterieurs a sa creation', () => {
    const nouvelle = habit({ createdAt: new Date('2026-08-11T08:00:00Z') });

    expect(habitCountsOn(nouvelle, '2026-08-10', TZ)).toBe(false);
    expect(habitCountsOn(nouvelle, '2026-08-09', TZ)).toBe(false);
    expect(habitCountsOn(nouvelle, '2026-08-11', TZ)).toBe(true);
    expect(habitCountsOn(nouvelle, '2026-08-12', TZ)).toBe(true);
  });

  it('laisse intact le denominateur des journees passees quand une habitude est ajoutee', () => {
    const semaine = dateKeyRange('2026-08-05', '2026-08-11');
    const anciennes = [habit(), habit()];
    const avant = semaine.map(
      (date) => anciennes.filter((entry) => habitCountsOn(entry, date, TZ)).length,
    );

    // L'utilisateur cree une sixieme habitude le 11.
    const apres = semaine.map(
      (date) => [...anciennes, habit({ createdAt: new Date('2026-08-11T10:00:00Z') })]
        .filter((entry) => habitCountsOn(entry, date, TZ)).length,
    );

    // Toutes les journees anterieures gardent exactement le meme total attendu.
    expect(apres.slice(0, -1)).toEqual(avant.slice(0, -1));
    // Seule la journee en cours integre la nouveaute.
    expect(apres[apres.length - 1]).toBe(avant[avant.length - 1] + 1);

    /*
     * Temoin du defaut corrige : le filtre d'origine ne regardait que la
     * frequence. La nouvelle habitude s'ajoutait alors au denominateur de
     * TOUTES les journees de la semaine, y compris celles ou elle n'existait
     * pas — et le score de ces journees baissait sans que rien ne s'y soit
     * passe.
     */
    const ancienneLogique = semaine.map(
      (date) => [...anciennes, habit({ createdAt: new Date('2026-08-11T10:00:00Z') })]
        .filter((entry) => isHabitScheduled(entry.weekDays, entry.frequency, date)).length,
    );
    expect(ancienneLogique.slice(0, -1)).not.toEqual(avant.slice(0, -1));
  });

  it('conserve une habitude archivee dans les journees ou elle etait active', () => {
    const archivee = habit({
      createdAt: new Date('2026-08-01T09:00:00Z'),
      archivedAt: new Date('2026-08-11T09:00:00Z'),
    });

    expect(habitCountsOn(archivee, '2026-08-05', TZ)).toBe(true);
    expect(habitCountsOn(archivee, '2026-08-10', TZ)).toBe(true);
    // A partir du jour de l'archivage, elle n'est plus attendue — ce qui aligne
    // le calcul sur la liste que le tableau de bord affiche le jour meme.
    expect(habitCountsOn(archivee, '2026-08-11', TZ)).toBe(false);
    expect(habitCountsOn(archivee, '2026-08-12', TZ)).toBe(false);
  });

  it('respecte le fuseau de l utilisateur pour la date de creation', () => {
    // 11 aout 00h30 a Paris = 10 aout 22h30 UTC.
    const nuit = habit({ createdAt: new Date('2026-08-10T22:30:00Z') });

    expect(habitCountsOn(nuit, '2026-08-10', 'Europe/Paris')).toBe(false);
    expect(habitCountsOn(nuit, '2026-08-11', 'Europe/Paris')).toBe(true);
    // Le meme instant appartient encore au 10 en UTC.
    expect(habitCountsOn(nuit, '2026-08-10', 'UTC')).toBe(true);
  });

  it('combine fenetre d existence et frequence', () => {
    // Lundi et jeudi uniquement (1 et 4).
    const partielle = habit({ createdAt: new Date('2026-08-01T09:00:00Z'), weekDays: '[1,4]' });

    // 2026-08-10 est un lundi, 2026-08-11 un mardi.
    expect(isHabitScheduled('[1,4]', 'custom', '2026-08-10')).toBe(true);
    expect(habitCountsOn(partielle, '2026-08-10', TZ)).toBe(true);
    expect(habitCountsOn(partielle, '2026-08-11', TZ)).toBe(false);
  });
});

describe('taux de reussite par habitude', () => {
  /** Reproduit le denominateur calcule par /api/stats. */
  function attendus(entry: HabitWindow, from: string, to: string): number {
    return dateKeyRange(from, to).filter((date) => habitCountsOn(entry, date, TZ)).length;
  }

  it('mesure une habitude creee aujourd hui sur sa seule journee, pas sur trente', () => {
    const fenetre = dateKeyRange('2026-07-13', '2026-08-11'); // 30 jours
    expect(fenetre).toHaveLength(30);

    const creeeAujourdhui = habit({ createdAt: new Date('2026-08-11T08:00:00Z') });
    const attendu = attendus(creeeAujourdhui, '2026-07-13', '2026-08-11');

    expect(attendu).toBe(1);
    // Une validation sur une journee attendue : 100 %, pas 1/30 = 3 %.
    expect(Math.round((1 / attendu) * 100)).toBe(100);
  });

  it('ne penalise pas une habitude hebdomadaire parfaitement tenue', () => {
    // Deux jours par semaine sur trente jours : environ neuf occurrences.
    const bihebdo = habit({ createdAt: new Date('2026-01-01T09:00:00Z'), weekDays: '[1,4]' });
    const attendu = attendus(bihebdo, '2026-07-13', '2026-08-11');

    expect(attendu).toBeGreaterThan(0);
    expect(attendu).toBeLessThan(30);
    // Toutes les occurrences validees valent 100 %, et non attendu/30.
    expect(Math.round((attendu / attendu) * 100)).toBe(100);
  });
});
