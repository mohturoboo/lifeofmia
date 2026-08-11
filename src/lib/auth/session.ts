import { cookies, headers } from 'next/headers';
import { randomBytes } from 'node:crypto';
import type { User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { signAccessToken, verifyAccessToken } from '@/lib/auth/jwt';
import { SESSION_COOKIE } from '@/lib/auth/constants';

export { SESSION_COOKIE };

/** Utilisateur authentifie tel qu'expose au reste de l'application. */
export type SessionUser = Pick<
  User,
  | 'id'
  | 'email'
  | 'firstName'
  | 'lastName'
  | 'avatarUrl'
  | 'locale'
  | 'theme'
  | 'timezone'
  | 'timeFormat'
  | 'city'
  | 'country'
  | 'latitude'
  | 'longitude'
  | 'units'
  | 'glassMl'
  | 'mainGoal'
  | 'xp'
  | 'level'
  | 'currentStreak'
  | 'longestStreak'
  | 'twoFactorEnabled'
  | 'heightCm'
  | 'birthDate'
  | 'gender'
  // Date de creation du compte : les vues analytiques s'en servent pour ne
  // jamais presenter de periode anterieure a l'existence du compte.
  | 'createdAt'
>;

const SESSION_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  locale: true,
  theme: true,
  timezone: true,
  timeFormat: true,
  city: true,
  country: true,
  latitude: true,
  longitude: true,
  units: true,
  glassMl: true,
  mainGoal: true,
  xp: true,
  level: true,
  currentStreak: true,
  longestStreak: true,
  twoFactorEnabled: true,
  heightCm: true,
  birthDate: true,
  gender: true,
  createdAt: true,
} as const;

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

/**
 * Cree une session : une ligne en base (revocable) + un cookie httpOnly signe.
 */
export async function createSession(user: User): Promise<string> {
  const sid = randomBytes(32).toString('base64url');
  const ttlMs = env.refreshTokenTtlDays * 86_400_000;
  const headerList = await headers();

  await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken: sid,
      userAgent: headerList.get('user-agent')?.slice(0, 255) ?? null,
      ip: clientIpFrom(headerList),
      expiresAt: new Date(Date.now() + ttlMs),
    },
  });

  const token = await signAccessToken({
    sub: user.id,
    sid,
    email: user.email,
    locale: user.locale,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, cookieOptions(Math.floor(ttlMs / 1000)));
  return token;
}

/** Revoque la session courante et supprime le cookie. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    const payload = await verifyAccessToken(token);
    if (payload) {
      await prisma.session
        .updateMany({
          where: { refreshToken: payload.sid, revokedAt: null },
          data: { revokedAt: new Date() },
        })
        .catch(() => undefined);
    }
  }

  cookieStore.set(SESSION_COOKIE, '', cookieOptions(0));
}

/** Revoque toutes les sessions d'un utilisateur (changement de mot de passe, 2FA...). */
export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Recupere l'utilisateur courant, ou `null`.
 * Double verification : signature du jeton **et** session non revoquee en base.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifyAccessToken(token);
  if (!payload) return null;

  const session = await prisma.session.findUnique({
    where: { refreshToken: payload.sid },
    select: { revokedAt: true, expiresAt: true },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;

  const user = await prisma.user.findFirst({
    where: { id: payload.sub, deletedAt: null },
    select: SESSION_USER_SELECT,
  });
  return user;
}

/** Variante levant une erreur — utilisee par les route handlers proteges. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    const error = new Error('UNAUTHORIZED');
    error.name = 'UnauthorizedError';
    throw error;
  }
  return user;
}

export function clientIpFrom(headerList: Headers): string | null {
  const forwarded = headerList.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? null;
  return headerList.get('x-real-ip');
}
