import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';

/**
 * Jetons a usage unique pour la verification d'email et la reinitialisation de
 * mot de passe.
 *
 * Le jeton en clair n'existe que dans l'email envoye a l'utilisateur ; la base
 * ne stocke que son empreinte SHA-256. Une fuite de la base ne permet donc pas
 * de prendre le controle d'un compte.
 */

export const TOKEN_TYPES = {
  EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
  PASSWORD_RESET: 'PASSWORD_RESET',
} as const;

export type TokenType = (typeof TOKEN_TYPES)[keyof typeof TOKEN_TYPES];

const TTL_MINUTES: Record<TokenType, number> = {
  EMAIL_VERIFICATION: 60 * 24, // 24 heures
  PASSWORD_RESET: 60, // 1 heure
};

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Cree un jeton et renvoie sa version en clair (a envoyer par email). */
export async function issueToken(userId: string, type: TokenType): Promise<string> {
  // Un seul jeton actif par type : les precedents sont invalides.
  await prisma.verificationToken.updateMany({
    where: { userId, type, usedAt: null },
    data: { usedAt: new Date() },
  });

  const plain = randomBytes(32).toString('base64url');
  await prisma.verificationToken.create({
    data: {
      userId,
      type,
      token: hashToken(plain),
      expiresAt: new Date(Date.now() + TTL_MINUTES[type] * 60_000),
    },
  });
  return plain;
}

/** Consomme un jeton et renvoie l'identifiant utilisateur, ou `null`. */
export async function consumeToken(plain: string, type: TokenType): Promise<string | null> {
  const record = await prisma.verificationToken.findUnique({
    where: { token: hashToken(plain) },
  });

  if (!record || record.type !== type || record.usedAt || record.expiresAt < new Date()) {
    return null;
  }

  await prisma.verificationToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });
  return record.userId;
}
