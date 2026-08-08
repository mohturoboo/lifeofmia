import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { publicRoute } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { forgotPasswordSchema } from '@/lib/validation/auth';
import { issueToken, TOKEN_TYPES } from '@/lib/auth/tokens';
import { RATE_LIMITS } from '@/lib/auth/rate-limit';
import { passwordResetEmail, sendMail } from '@/lib/mailer';
import { audit } from '@/lib/audit';

/**
 * POST /api/auth/forgot-password
 *
 * La reponse est identique que l'adresse existe ou non : un attaquant ne peut
 * pas s'en servir pour dresser la liste des comptes enregistres.
 */
export const POST = publicRoute(
  async ({ body }) => {
    const user = await prisma.user.findFirst({
      where: { email: body.email, deletedAt: null },
      select: { id: true, email: true, firstName: true },
    });

    if (user) {
      const token = await issueToken(user.id, TOKEN_TYPES.PASSWORD_RESET);
      await sendMail(passwordResetEmail(user.email, user.firstName, token));
      await audit({ action: 'PASSWORD_RESET_REQUEST', userId: user.id, headers: await headers() });
    }

    return ok({ sent: true });
  },
  { schema: forgotPasswordSchema, rateLimit: { key: 'forgot', ...RATE_LIMITS.passwordReset } },
);
