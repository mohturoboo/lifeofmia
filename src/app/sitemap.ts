import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

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

  return [
    { url: env.appUrl, lastModified: maintenant, changeFrequency: 'monthly', priority: 1 },
    { url: `${env.appUrl}/login`, lastModified: maintenant, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${env.appUrl}/register`, lastModified: maintenant, changeFrequency: 'yearly', priority: 0.8 },
    {
      url: `${env.appUrl}/forgot-password`,
      lastModified: maintenant,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
  ];
}
