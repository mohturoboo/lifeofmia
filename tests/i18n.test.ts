import { describe, expect, it } from 'vitest';
import { DICTIONARIES, createTranslator, formatNumber } from '@/i18n';
import { LOCALES, LOCALE_META, directionOf, isLocale, resolveLocale } from '@/i18n/config';
import { fr } from '@/i18n/locales/fr';
import { quoteOfTheDay, quoteCount } from '@/lib/quotes';

describe('internationalisation', () => {
  const keys = Object.keys(fr);

  it('fournit les huit langues annoncees', () => {
    expect(LOCALES).toHaveLength(8);
    expect(Object.keys(DICTIONARIES)).toHaveLength(8);
  });

  it('traduit toutes les cles dans toutes les langues', () => {
    for (const locale of LOCALES) {
      const dictionary = DICTIONARIES[locale];
      const missing = keys.filter((key) => !(key in dictionary));
      expect(missing, `cles manquantes en ${locale}`).toEqual([]);
    }
  });

  it('ne laisse aucune traduction vide', () => {
    for (const locale of LOCALES) {
      const empty = Object.entries(DICTIONARIES[locale])
        .filter(([, value]) => value.trim().length === 0)
        .map(([key]) => key);
      expect(empty, `traductions vides en ${locale}`).toEqual([]);
    }
  });

  it('n\'introduit aucune cle superflue', () => {
    /*
     * Une langue peut porter des formes plurielles que le francais ignore :
     * l'arabe en distingue six la ou le francais n'en a que deux. Ce ne sont
     * pas des cles superflues mais les memes cles declinees — a condition que
     * leur racine existe dans le dictionnaire de reference et que le suffixe
     * soit une categorie du CLDR. Tout le reste reste une faute.
     */
    const CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'];
    const racines = new Set(
      keys.filter((key) => key.endsWith('_one')).map((key) => key.slice(0, -'_one'.length)),
    );
    const formePlurielleValide = (key: string) => {
      const separateur = key.lastIndexOf('_');
      if (separateur === -1) return false;
      return racines.has(key.slice(0, separateur)) && CATEGORIES.includes(key.slice(separateur + 1));
    };

    for (const locale of LOCALES) {
      const extra = Object.keys(DICTIONARIES[locale]).filter(
        (key) => !keys.includes(key) && !formePlurielleValide(key),
      );
      expect(extra, `cles en trop en ${locale}`).toEqual([]);
    }
  });

  it('marque l\'arabe comme langue de droite a gauche', () => {
    expect(directionOf('ar')).toBe('rtl');
    expect(directionOf('fr')).toBe('ltr');
    for (const locale of LOCALES) {
      expect(LOCALE_META[locale].dir).toMatch(/^(ltr|rtl)$/);
    }
  });

  it('valide et normalise le code de langue', () => {
    expect(isLocale('fr')).toBe(true);
    expect(isLocale('zz')).toBe(false);
    expect(resolveLocale('de')).toBe('de');
    expect(resolveLocale('inconnu')).toBe('fr');
    expect(resolveLocale(undefined)).toBe('fr');
  });

  it('interpole les valeurs dans une traduction', () => {
    const t = createTranslator('fr');
    // Aucune cle du dictionnaire ne contient de variable aujourd'hui ; on
    // verifie le mecanisme sur une cle inexistante, renvoyee telle quelle.
    expect(t('{count} jours' as never, { count: 12 })).toBe('12 jours');
  });

  it('renvoie la cle brute quand elle n\'existe pas', () => {
    const t = createTranslator('en');
    expect(t('cle.inexistante' as never)).toBe('cle.inexistante');
  });

  it('formate les nombres selon la langue', () => {
    expect(formatNumber('fr', 1234.5)).toContain('234');
    expect(formatNumber('en', 1234)).toBe('1,234');
  });
});

describe('citation du jour', () => {
  it('est stable pour une meme date et un meme utilisateur', () => {
    const first = quoteOfTheDay('2026-08-07', 'fr', 'user_1');
    const second = quoteOfTheDay('2026-08-07', 'fr', 'user_1');
    expect(first).toEqual(second);
  });

  it('change d\'un jour a l\'autre', () => {
    const quotes = new Set(
      Array.from({ length: quoteCount }, (_, index) =>
        quoteOfTheDay(`2026-08-${String(index + 1).padStart(2, '0')}`, 'fr', 'user_1').text,
      ),
    );
    expect(quotes.size).toBeGreaterThan(1);
  });

  it('est traduite dans chaque langue', () => {
    for (const locale of LOCALES) {
      const quote = quoteOfTheDay('2026-08-07', locale, 'user_1');
      expect(quote.text.length).toBeGreaterThan(10);
      expect(quote.author.length).toBeGreaterThan(0);
    }
  });

  it('differencie deux utilisateurs le meme jour', () => {
    const results = new Set(
      ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => quoteOfTheDay('2026-08-07', 'fr', id).text),
    );
    expect(results.size).toBeGreaterThan(1);
  });
});
