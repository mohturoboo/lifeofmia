import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { updateProfileSchema } from '@/lib/validation/auth';
import { destroySession } from '@/lib/auth/session';
import { levelProgress } from '@/lib/gamification';
import { searchCity, FALLBACK_CITIES } from '@/lib/weather';
import { audit } from '@/lib/audit';
import { methodeRefusee, optionsPour, type MethodeHttp } from '@/lib/api/methodes';

/** GET /api/profile — profil complet + progression de niveau. */
export const GET = route(async ({ user }) => {
  const [full, badges, sessions] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        id: true, email: true, firstName: true, lastName: true, avatarUrl: true,
        country: true, city: true, latitude: true, longitude: true, timezone: true,
        locale: true, theme: true, timeFormat: true, units: true, glassMl: true,
        birthDate: true, gender: true, heightCm: true, mainGoal: true,
        twoFactorEnabled: true, marketingOptIn: true,
        xp: true, level: true, currentStreak: true, longestStreak: true, createdAt: true,
      },
    }),
    prisma.userBadge.findMany({
      where: { userId: user.id },
      include: { badge: true },
      orderBy: { unlockedAt: 'desc' },
    }),
    prisma.session.findMany({
      where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, userAgent: true, ip: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  return ok({
    profile: full,
    progress: levelProgress(full.xp),
    badges: badges.map((entry) => ({ ...entry.badge, unlockedAt: entry.unlockedAt })),
    sessions,
  });
});

/**
 * PATCH /api/profile — mise a jour partielle.
 *
 * Si la ville change sans coordonnees fournies, on tente de les resoudre
 * automatiquement : c'est ce qui fait basculer les horaires de priere et la
 * meteo sur le nouveau lieu sans autre action de l'utilisateur.
 */
export const PATCH = route(
  async ({ user, body }) => {
    const data: Record<string, unknown> = {};

    for (const key of [
      'firstName', 'lastName', 'avatarUrl', 'country', 'timezone', 'locale',
      'theme', 'timeFormat', 'units', 'glassMl', 'gender', 'heightCm', 'mainGoal', 'marketingOptIn',
    ] as const) {
      if (body[key] !== undefined) data[key] = body[key];
    }

    if (body.birthDate !== undefined) {
      const parsed = body.birthDate ? new Date(body.birthDate) : null;
      data.birthDate = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
    }

    if (body.city !== undefined) {
      data.city = body.city;

      /*
       * Le fuseau est rededuit quand la ville CHANGE reellement.
       *
       * Le formulaire renvoie tous ses champs a chaque enregistrement : sans
       * cette comparaison, modifier son fuseau seul le verrait ecrase par celui
       * de la ville. Et sans rededuction du tout, une ville nouvelle gardait
       * l'ancien fuseau — c'est ainsi qu'un profil se retrouve a Paris avec
       * l'heure de Casablanca.
       */
      const villeChange = body.city !== user.city;

      if (body.latitude === undefined || body.longitude === undefined) {
        const fallback = FALLBACK_CITIES[body.city];
        if (fallback) {
          data.latitude = fallback.latitude;
          data.longitude = fallback.longitude;
          if (villeChange) data.timezone = fallback.timezone;
          else data.timezone = data.timezone ?? fallback.timezone;
        } else {
          const [match] = await searchCity(body.city);
          if (match) {
            data.latitude = match.latitude;
            data.longitude = match.longitude;
          }
        }
      }
    }

    if (body.latitude !== undefined) data.latitude = body.latitude;
    if (body.longitude !== undefined) data.longitude = body.longitude;

    const updated = await prisma.user.update({
      where: { id: user.id },
      data,
      select: {
        id: true, firstName: true, lastName: true, city: true, country: true,
        latitude: true, longitude: true, timezone: true, locale: true, theme: true,
        timeFormat: true, units: true, glassMl: true, heightCm: true, mainGoal: true, avatarUrl: true,
      },
    });

    await audit({
      action: 'PROFILE_UPDATE',
      userId: user.id,
      headers: await headers(),
      meta: { fields: Object.keys(data) },
    });

    return ok(updated);
  },
  { schema: updateProfileSchema },
);

/**
 * DELETE /api/profile — suppression du compte (RGPD, droit a l'effacement).
 * Les cascades du schema effacent l'integralite des donnees liees.
 */
export const DELETE = route(async ({ user }) => {
  await audit({ action: 'DELETE_ACCOUNT', userId: user.id, headers: await headers() });
  await prisma.user.delete({ where: { id: user.id } });
  await destroySession();
  return ok({ deleted: true });
});

// --- Methodes non prises en charge
//
// Sans handler declare, Next.js repond en HTML sous une URL qui promet du
// JSON : le client echouait sur « Unexpected token '<' ». Le 405 porte
// desormais le meme format que toutes les autres erreurs, et l'en-tete
// `Allow` annonce ce qui est accepte.
const AUTORISEES: MethodeHttp[] = ['GET', 'PATCH', 'DELETE'];
export const POST = methodeRefusee(AUTORISEES);
export const PUT = methodeRefusee(AUTORISEES);
export const OPTIONS = optionsPour(AUTORISEES);
