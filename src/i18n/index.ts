import { DEFAULT_LOCALE, LOCALE_META, resolveLocale, type Locale } from '@/i18n/config';
import { fr, type Dictionary, type DictionaryKey } from '@/i18n/locales/fr';
import { en } from '@/i18n/locales/en';
import { ar } from '@/i18n/locales/ar';
import { es } from '@/i18n/locales/es';
import { de } from '@/i18n/locales/de';
import { it } from '@/i18n/locales/it';
import { pt } from '@/i18n/locales/pt';
import { tr } from '@/i18n/locales/tr';

/**
 * Registre des dictionnaires.
 *
 * Les huit langues sont chargees ensemble : elles pesent quelques dizaines de
 * kilo-octets au total, et cette approche permet de changer de langue
 * instantanement, sans rechargement ni requete supplementaire.
 */
export const DICTIONARIES: Record<Locale, Dictionary> = { fr, en, ar, es, de, it, pt, tr };

export type Translator = (key: DictionaryKey, values?: Record<string, string | number>) => string;

/**
 * Construit la fonction de traduction d'une langue.
 * L'interpolation utilise la syntaxe `{nom}` :
 *   t('goals.daysLeft', { count: 12 })
 */
export function createTranslator(locale: Locale): Translator {
  const dictionary = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
  const fallback = DICTIONARIES[DEFAULT_LOCALE];

  /*
   * Les regles de pluriel de la langue, pas celles du francais.
   *
   * L'interface affichait « 1 jours », « 1 Badges », « 0 jours d'affilee » :
   * le nombre etait colle a un libelle invariable. Le probleme n'est pas
   * cosmetique — l'anglais et le francais coupent a un endroit different (0 est
   * singulier en anglais, pluriel en francais), le turc n'accorde pas, et
   * l'arabe distingue six formes. Aucune concatenation ne peut couvrir cela.
   */
  const pluriels = (() => {
    try {
      return new Intl.PluralRules(LOCALE_META[locale].intl);
    } catch {
      return null;
    }
  })();

  return (key, values) => {
    let cle: string = key;

    /*
     * Une cle a pluriel n'existe QUE sous ses formes suffixees. Quand un
     * `count` est fourni, on cherche la forme de la categorie, puis `_other`
     * — l'arabe peut ne pas definir `_few` la ou le francais n'a que deux
     * formes, et l'inverse ne doit jamais produire une cle brute a l'ecran.
     */
    const count = values?.count;
    if (typeof count === 'number' && pluriels) {
      const categorie = pluriels.select(count);
      const candidates = [`${key}_${categorie}`, `${key}_other`, key];
      cle = candidates.find((essai) => essai in dictionary || essai in fallback) ?? key;
    }

    const table = dictionary as Record<string, string | undefined>;
    const secours = fallback as Record<string, string | undefined>;
    let text = table[cle] ?? secours[cle] ?? key;

    if (values) {
      for (const [name, value] of Object.entries(values)) {
        /*
         * Les nombres passent par `Intl.NumberFormat` : sans cela, l'arabe
         * melangeait sur un meme ecran des chiffres arabo-indiens rendus par
         * `Intl` et des chiffres occidentaux issus de `String(value)`.
         */
        const rendu = typeof value === 'number' ? formatNumber(locale, value) : String(value);
        text = text.replaceAll(`{${name}}`, rendu);
      }
    }
    return text;
  };
}

/** Formatage des nombres dans la langue de l'utilisateur. */
export function formatNumber(locale: Locale, value: number, options?: Intl.NumberFormatOptions): string {
  try {
    return new Intl.NumberFormat(LOCALE_META[locale].intl, options).format(value);
  } catch {
    return String(value);
  }
}

/** Formatage d'une date complete (« lundi 7 aout 2026 »). */
export function formatFullDate(locale: Locale, date: Date, timezone?: string): string {
  try {
    return new Intl.DateTimeFormat(LOCALE_META[locale].intl, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: timezone,
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function formatShortDate(locale: Locale, date: Date, timezone?: string): string {
  try {
    return new Intl.DateTimeFormat(LOCALE_META[locale].intl, {
      day: '2-digit',
      month: 'short',
      timeZone: timezone,
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export { DEFAULT_LOCALE, LOCALE_META, resolveLocale };
export type { Locale, Dictionary, DictionaryKey };
