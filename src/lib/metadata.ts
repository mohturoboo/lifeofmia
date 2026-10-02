import type { Metadata } from 'next';
import { createTranslator, type DictionaryKey } from '@/i18n';
import { resolveLocale } from '@/i18n/config';
import { getCurrentUser } from '@/lib/auth/session';

/**
 * Titre de page traduit dans la langue du compte (francais pour un visiteur).
 *
 * Les pages sont des composants client : leur titre est porte par un
 * `layout.tsx` serveur minimal, complete par le gabarit `%s · LifeofM` du
 * layout racine. Sans lui, toutes les pages partageaient le meme `<title>`
 * (WCAG 2.4.2).
 */
export function titreDePage(cle: DictionaryKey) {
  return async function generateMetadata(): Promise<Metadata> {
    const user = await getCurrentUser().catch(() => null);
    return { title: createTranslator(resolveLocale(user?.locale))(cle) };
  };
}
