import { describe, expect, it } from 'vitest';
import { DICTIONARIES } from '@/i18n';
import { controlerDictionnaires, motsDesaccentues } from '@/i18n/controle';
import type { Dictionary } from '@/i18n/locales/fr';

/** Les memes verifications que `npm run lint:i18n`, executees avec la suite. */
describe('controle des dictionnaires', () => {
  it('ne signale aucune erreur sur les dictionnaires actuels', () => {
    expect(controlerDictionnaires(DICTIONARIES).erreurs).toEqual([]);
  });

  it('detecte une cle manquante, une variable perdue et un mot desaccentue', () => {
    const fr = { ...DICTIONARIES.fr, 'nav.settings': 'Reglages' } as Dictionary;
    const en = { ...DICTIONARIES.en, 'common.dayCount_other': 'days' } as Record<string, string>;
    delete en['nav.notes'];
    const { erreurs } = controlerDictionnaires({ ...DICTIONARIES, fr, en: en as Dictionary });

    expect(erreurs).toContain('[en] cle manquante : nav.notes');
    expect(erreurs).toContain('[en] common.dayCount_other : variable(s) absente(s) count');
    expect(erreurs).toContain('[fr] nav.settings : « Reglages » sans accents');
  });

  it('ne confond pas un mot accentue avec sa forme desaccentuee', () => {
    expect(motsDesaccentues('Été, réglages, prières, début')).toEqual([]);
    expect(motsDesaccentues('Ete, reglages, prieres')).toEqual(['Ete', 'reglages', 'prieres']);
  });
});
