import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { clientIp, publicRoute } from '@/lib/api/handler';
import { fail, ok } from '@/lib/api/response';
import { forgotPasswordSchema } from '@/lib/validation/auth';
import { issueToken, TOKEN_TYPES } from '@/lib/auth/tokens';
import { LOGIN_BACKOFF, RATE_LIMITS } from '@/lib/auth/rate-limit';
import { bucketCompte, bucketIp, consumePartage } from '@/lib/auth/rate-limit-store';
import { passwordResetEmail, sendMail } from '@/lib/mailer';
import { audit } from '@/lib/audit';
import { methodeRefusee, optionsPour, type MethodeHttp } from '@/lib/api/methodes';

/**
 * POST /api/auth/forgot-password
 *
 * La reponse est identique que l'adresse existe ou non : un attaquant ne peut
 * pas s'en servir pour dresser la liste des comptes enregistres.
 */
export const POST = publicRoute(
  async ({ request, body }) => {
    /*
     * Deux compteurs partages : par adresse IP, contre l'arrosage general, et
     * par adresse email, contre le harcelement d'une boite precise.
     *
     * Le second compte les tentatives meme quand l'adresse est inconnue —
     * sinon seules les adresses reelles seraient ralenties, et le silence
     * soigneusement construit plus bas se lirait dans le temps de reponse.
     */
    const debits = await Promise.all([
      consumePartage(bucketIp('forgot', clientIp(request)), { ...RATE_LIMITS.passwordResetIp, ...LOGIN_BACKOFF }),
      consumePartage(bucketCompte('forgot', body.email), { ...RATE_LIMITS.passwordReset, ...LOGIN_BACKOFF }),
    ]);
    const bloque = debits.find((debit) => !debit.allowed);
    if (bloque) {
      return fail(
        'RATE_LIMITED',
        `Trop de demandes. Reessayez dans ${Math.ceil(bloque.retryAfterSeconds / 60)} minute(s).`,
        undefined,
        { 'Retry-After': String(bloque.retryAfterSeconds) },
      );
    }

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
