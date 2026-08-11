import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

/**
 * robots.txt
 *
 * Le fichier etait absent : les robots recevaient une 404 et se rabattaient
 * sur leur comportement par defaut, c'est-a-dire tout explorer. Sur une
 * application dont l'essentiel des URL est un espace personnel, mieux vaut le
 * dire explicitement.
 *
 * Seules les pages publiques sont ouvertes. Tout le reste — l'espace connecte,
 * l'API, les ecrans d'authentification — est ferme. L'interdiction n'est pas
 * une protection (elle repose sur la bonne volonte du robot ; la vraie barriere
 * reste le middleware d'authentification), mais elle evite que des URL privees
 * se retrouvent indexees a la faveur d'un lien partage.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login', '/register', '/forgot-password'],
        disallow: [
          '/api/',
          '/dashboard',
          '/habits',
          '/tasks',
          '/goals',
          '/nutrition',
          '/weight',
          '/sport',
          '/journal',
          '/prayers',
          '/calendar',
          '/finance',
          '/notes',
          '/stats',
          '/compare',
          '/ai',
          '/settings',
          '/reset-password',
        ],
      },
    ],
    sitemap: `${env.appUrl}/sitemap.xml`,
    host: env.appUrl,
  };
}
