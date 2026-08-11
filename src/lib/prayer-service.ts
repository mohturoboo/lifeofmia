import { prisma } from '@/lib/prisma';
import { fetchPrayerTimes, type PrayerTimes } from '@/lib/prayer';
import { FALLBACK_CITIES } from '@/lib/cities';
import type { DateKey } from '@/lib/date';
import type { SessionUser } from '@/lib/auth/session';

/**
 * Source unique des horaires de priere.
 *
 * Deux points d'entree les calculaient chacun de leur cote, et l'un d'eux
 * codait la methode en dur : `/api/dashboard` passait `method: 3, school: 0`
 * alors qu'il chargeait les reglages de l'utilisateur dans la meme requete
 * sans les utiliser. Resultat, pour un meme profil et un meme jour :
 *
 *   Fajr    03:21 au tableau de bord   contre   03:49 sur la page Prieres
 *   Isha    22:20                                22:01
 *
 * Seules ces deux heures divergeaient, et c'est logique : ce sont les seules a
 * dependre de l'angle crepusculaire, donc de la methode. Les quatre autres,
 * fixees par la position du soleil, concordaient — ce qui rendait l'ecart
 * d'autant plus difficile a expliquer.
 *
 * Tout passe desormais par ici : la methode, le madhhab et les coordonnees
 * viennent du profil, jamais d'une constante.
 */
export interface ResultatPrieres {
  times: PrayerTimes;
  source: 'aladhan' | 'local';
  method: number;
  school: number;
  latitude: number;
  longitude: number;
}

/**
 * Coordonnees de l'utilisateur.
 *
 * En dernier recours on se rabat sur la ville declaree, jamais sur une capitale
 * arbitraire : afficher les horaires de Paris a quelqu'un qui n'a pas de
 * coordonnees serait faux sans le dire. Sans repere exploitable, on renonce.
 */
function coordonnees(user: SessionUser): { latitude: number; longitude: number } | null {
  if (user.latitude !== null && user.longitude !== null) {
    return { latitude: user.latitude, longitude: user.longitude };
  }

  const ville = FALLBACK_CITIES[user.city];
  return ville ? { latitude: ville.latitude, longitude: ville.longitude } : null;
}

/** Reglages de calcul du profil, crees a la volee au premier acces. */
export async function prayerSettingsFor(userId: string) {
  return (
    (await prisma.prayerSettings.findUnique({ where: { userId } })) ??
    (await prisma.prayerSettings.create({ data: { userId } }))
  );
}

export async function getPrayerTimes(user: SessionUser, date: DateKey): Promise<ResultatPrieres | null> {
  const position = coordonnees(user);
  if (!position) return null;

  const settings = await prayerSettingsFor(user.id);

  const resultat = await fetchPrayerTimes({
    date,
    latitude: position.latitude,
    longitude: position.longitude,
    timezone: user.timezone,
    method: settings.method,
    school: settings.school as 0 | 1,
  });

  return {
    ...resultat,
    method: settings.method,
    school: settings.school,
    ...position,
  };
}
