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

  return (key, values) => {
    let text = dictionary[key] ?? fallback[key] ?? key;
    if (values) {
      for (const [name, value] of Object.entries(values)) {
        text = text.replaceAll(`{${name}}`, String(value));
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
