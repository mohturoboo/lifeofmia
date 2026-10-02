/**
 * Liste unique des pages de l'application.
 *
 * Elle etait recopiee dans le middleware et dans robots.txt : une page ajoutee
 * a l'un seulement devenait accessible sans connexion ou indexee. Ce fichier
 * ne depend de rien (le middleware tourne en runtime Edge).
 */

/** Pages accessibles uniquement lorsqu'on n'est PAS connecte. */
export const GUEST_ONLY_PAGES = ['/login', '/register', '/forgot-password', '/reset-password'] as const;

/** Prefixes de l'espace connecte : toute autre page applicative exige une session. */
export const PROTECTED_PREFIXES = [
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
] as const;

/** Pages publiques referencees par robots.txt et le plan de site (hors lien de reinitialisation). */
export const INDEXABLE_PAGES = [
  { path: '', changeFrequency: 'monthly', priority: 1 },
  { path: '/login', changeFrequency: 'yearly', priority: 0.5 },
  { path: '/register', changeFrequency: 'yearly', priority: 0.8 },
  { path: '/forgot-password', changeFrequency: 'yearly', priority: 0.2 },
] as const;
