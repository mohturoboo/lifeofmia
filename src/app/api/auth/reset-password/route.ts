import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { publicRoute } from '@/lib/api/handler';
import { ok, fail } from '@/lib/api/response';
import { resetPasswordSchema } from '@/lib/validation/auth';
import { hashPassword } from '@/lib/auth/password';
import { consumeToken, TOKEN_TYPES } from '@/lib/auth/tokens';
import { revokeAllSessions } from '@/lib/auth/session';
import { RATE_LIMITS } from '@/lib/auth/rate-limit';
import { audit } from '@/lib/audit';
import { methodeRefusee, optionsPour, type MethodeHttp } from '@/lib/api/methodes';

/**
 * POST /api/auth/reset-password
 *
 * Le changement de mot de passe revoque toutes les sessions existantes : si le
 * compte etait compromis, l'attaquant est immediatement deconnecte.
 */
export const POST = publicRoute(
  async ({ body }) => {
    const userId = await consumeToken(body.token, TOKEN_TYPES.PASSWORD_RESET);
    if (!userId) {
      return fail('BAD_REQUEST', 'Ce lien est invalide ou a expire.', {
        token: 'Lien invalide ou expire.',
      });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: await hashPassword(body.password),
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });

    await revokeAllSessions(userId);
    await audit({ action: 'PASSWORD_RESET', userId, headers: await headers() });

    return ok({ success: true });
  },
  { schema: resetPasswordSchema, rateLimit: { key: 'reset', ...RATE_LIMITS.passwordReset } },
);

// --- Methodes non prises en charge
//
// Sans handler declare, Next.js repond en HTML sous une URL qui promet du
// JSON : le client echouait sur « Unexpected token '<' ». Le 405 porte
// desormais le meme format que toutes les autres erreurs, et l'en-tete
// `Allow` annonce ce qui est accepte.
const AUTORISEES: MethodeHttp[] = ['POST'];
export const GET = methodeRefusee(AUTORISEES);
export const PUT = methodeRefusee(AUTORISEES);
export const PATCH = methodeRefusee(AUTORISEES);
export const DELETE = methodeRefusee(AUTORISEES);
export const OPTIONS = optionsPour(AUTORISEES);
