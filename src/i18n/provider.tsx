'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { createTranslator, formatNumber, type Locale, type Translator } from '@/i18n';
import { directionOf } from '@/i18n/config';

/**
 * Contexte d'internationalisation cote client.
 *
 * La langue initiale vient du serveur (profil utilisateur), ce qui evite tout
 * clignotement au premier rendu. Le changement de langue est immediat cote
 * client, puis persiste via `PATCH /api/profile`.
 */

interface I18nValue {
  locale: Locale;
  dir: 'ltr' | 'rtl';
  t: Translator;
  n: (value: number, options?: Intl.NumberFormatOptions) => string;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    document.documentElement.lang = next;
    document.documentElement.dir = directionOf(next);
    // Persistance silencieuse : un echec reseau ne doit pas casser l'interface.
    void fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: next }),
    }).catch(() => undefined);
  }, []);

  const value = useMemo<I18nValue>(() => {
    const t = createTranslator(locale);
    return {
      locale,
      dir: directionOf(locale),
      t,
      n: (input, options) => formatNumber(locale, input, options),
      setLocale,
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n doit etre utilise a l\'interieur de <I18nProvider>.');
  }
  return context;
}

/** Raccourci le plus courant dans les composants. */
export function useT(): Translator {
  return useI18n().t;
}
