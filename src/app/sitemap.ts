import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';
import { INDEXABLE_PAGES } from '@/config/routes';

/**
 * sitemap.xml
 *
 * Seules les pages PUBLIQUES y figurent. Un plan de site n'est pas un
 * inventaire de l'application : y lister l'espace connecte reviendrait a
 * publier la carte de ce qu'on vient d'interdire dans robots.txt, et a
 * demander leur indexation a des URL qui repondent par une redirection vers la
 * connexion.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const maintenant = new Date();

  return INDEXABLE_PAGES.map(({ path, changeFrequency, priority }) => ({
    url: `${env.appUrl}${path}`,
    lastModified: maintenant,
    changeFrequency,
    priority,
  }));
}
