import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { publicRoute, route } from '@/lib/api/handler';
import { ok, fail } from '@/lib/api/response';
import { verifyEmailSchema } from '@/lib/validation/auth';
import { consumeToken, issueToken, TOKEN_TYPES } from '@/lib/auth/tokens';
import { RATE_LIMITS } from '@/lib/auth/rate-limit';
import { sendMail, verificationEmail } from '@/lib/mailer';
import { awardXp } from '@/lib/gamification';
import { audit } from '@/lib/audit';

/** POST /api/auth/verify-email — consomme le jeton recu par email. */
export const POST = publicRoute(
  async ({ body }) => {
    const userId = await consumeToken(body.token, TOKEN_TYPES.EMAIL_VERIFICATION);
    if (!userId) {
      return fail('BAD_REQUEST', 'Ce lien est invalide ou a expire.');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerified: true },
    });

    if (!user?.emailVerified) {
      await prisma.user.update({ where: { id: userId }, data: { emailVerified: new Date() } });
      await awardXp(userId, 25, 'Adresse email confirmee', 'badge');
      await audit({ action: 'EMAIL_VERIFIED', userId, headers: await headers() });
    }

    return ok({ verified: true });
  },
  { schema: verifyEmailSchema, rateLimit: { key: 'verify', ...RATE_LIMITS.passwordReset } },
);

/** PUT /api/auth/verify-email — renvoie l'email de verification (utilisateur connecte). */
export const PUT = route(async ({ user }) => {
  if (user.emailVerified) return ok({ alreadyVerified: true });

  const token = await issueToken(user.id, TOKEN_TYPES.EMAIL_VERIFICATION);
  await sendMail(verificationEmail(user.email, user.firstName, token));
  return ok({ sent: true });
});
