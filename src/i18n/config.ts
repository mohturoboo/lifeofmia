/**
 * Configuration de l'internationalisation.
 *
 * Le dictionnaire francais fait office de reference : le type `Dictionary` en
 * est derive, ce qui force chaque autre langue a fournir exactement les memes
 * cles — une traduction oubliee devient une erreur de compilation.
 */

export const LOCALES = ['fr', 'en', 'ar', 'es', 'de', 'it', 'pt', 'tr'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'fr';

export interface LocaleMeta {
  code: Locale;
  label: string; // nom de la langue dans la langue elle-meme
  flag: string;
  dir: 'ltr' | 'rtl';
  intl: string; // identifiant BCP-47 pour Intl
}

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  fr: { code: 'fr', label: 'Francais', flag: '🇫🇷', dir: 'ltr', intl: 'fr-FR' },
  en: { code: 'en', label: 'English', flag: '🇬🇧', dir: 'ltr', intl: 'en-US' },
  ar: { code: 'ar', label: 'العربية', flag: '🇸🇦', dir: 'rtl', intl: 'ar-SA' },
  es: { code: 'es', label: 'Espanol', flag: '🇪🇸', dir: 'ltr', intl: 'es-ES' },
  de: { code: 'de', label: 'Deutsch', flag: '🇩🇪', dir: 'ltr', intl: 'de-DE' },
  it: { code: 'it', label: 'Italiano', flag: '🇮🇹', dir: 'ltr', intl: 'it-IT' },
  pt: { code: 'pt', label: 'Portugues', flag: '🇵🇹', dir: 'ltr', intl: 'pt-PT' },
  tr: { code: 'tr', label: 'Turkce', flag: '🇹🇷', dir: 'ltr', intl: 'tr-TR' },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function resolveLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function directionOf(locale: Locale): 'ltr' | 'rtl' {
  return LOCALE_META[locale].dir;
}
