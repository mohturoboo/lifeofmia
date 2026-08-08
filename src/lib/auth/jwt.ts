import { SignJWT, jwtVerify } from 'jose';
import { env } from '@/lib/env';

/**
 * Emission et verification des jetons de session (HS256).
 * `jose` fonctionne aussi bien dans le runtime Node que dans le runtime Edge,
 * ce qui permet au middleware de valider un jeton sans toucher a la base.
 */

export interface AccessTokenPayload {
  sub: string; // identifiant utilisateur
  sid: string; // identifiant de session (permet la revocation cote serveur)
  email: string;
  locale: string;
}

const ISSUER = 'lifeofm';
const AUDIENCE = 'lifeofm-app';

let cachedKey: Uint8Array | null = null;
function secretKey(): Uint8Array {
  if (!cachedKey) cachedKey = new TextEncoder().encode(env.authSecret);
  return cachedKey;
}

export async function signAccessToken(
  payload: AccessTokenPayload,
  expiresIn: string = `${env.refreshTokenTtlDays}d`,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(payload.sub)
    .setExpirationTime(expiresIn)
    .sign(secretKey());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') return null;
    return {
      sub: payload.sub,
      sid: payload.sid,
      email: String(payload.email ?? ''),
      locale: String(payload.locale ?? 'fr'),
    };
  } catch {
    // Jeton expire, signature invalide ou malforme : dans tous les cas, non authentifie.
    return null;
  }
}
