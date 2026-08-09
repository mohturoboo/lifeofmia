/**
 * Coordonnees de repli pour les villes les plus courantes.
 *
 * Ce module ne contient que des donnees statiques, sans aucune dependance :
 * les pages client (inscription, reglages) peuvent l'importer sans entrainer
 * `lib/weather` — et avec lui `lib/env` — dans le bundle du navigateur.
 */

/** Coordonnees de repli pour les villes les plus courantes (mode hors ligne). */
export const FALLBACK_CITIES: Record<string, { latitude: number; longitude: number; timezone: string }> = {
  Paris: { latitude: 48.8566, longitude: 2.3522, timezone: 'Europe/Paris' },
  Marseille: { latitude: 43.2965, longitude: 5.3698, timezone: 'Europe/Paris' },
  Lyon: { latitude: 45.764, longitude: 4.8357, timezone: 'Europe/Paris' },
  Bruxelles: { latitude: 50.8503, longitude: 4.3517, timezone: 'Europe/Brussels' },
  Londres: { latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London' },
  Casablanca: { latitude: 33.5731, longitude: -7.5898, timezone: 'Africa/Casablanca' },
  Alger: { latitude: 36.7538, longitude: 3.0588, timezone: 'Africa/Algiers' },
  Tunis: { latitude: 36.8065, longitude: 10.1815, timezone: 'Africa/Tunis' },
  Dubai: { latitude: 25.2048, longitude: 55.2708, timezone: 'Asia/Dubai' },
  Istanbul: { latitude: 41.0082, longitude: 28.9784, timezone: 'Europe/Istanbul' },
  'New York': { latitude: 40.7128, longitude: -74.006, timezone: 'America/New_York' },
  Montreal: { latitude: 45.5017, longitude: -73.5673, timezone: 'America/Toronto' },
};
