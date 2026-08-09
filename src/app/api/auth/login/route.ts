import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { publicRoute } from '@/lib/api/handler';
import { ok, fail } from '@/lib/api/response';
import { loginSchema } from '@/lib/validation/auth';
import { verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { RATE_LIMITS } from '@/lib/auth/rate-limit';
import { audit } from '@/lib/audit';

/** Verrouillage progressif du compte apres des echecs repetes. */
const MAX_ATTEMPTS = 8;
const LOCK_MINUTES = 15;

/**
 * Hachage bcrypt d'une valeur arbitraire, utilise pour egaliser le temps de
 * reponse quand l'adresse email n'existe pas (voir plus bas).
 */
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.6ZP0.Q0ZP0Q0ZP0Q0ZP0Q0ZP0Q0ZP0Q';

/**
 * POST /api/auth/login
 *
 * Deux protections se completent :
 *  - la limitation de debit par adresse IP (dans `publicRoute`), qui bloque le
 *    balayage d'un grand nombre de comptes ;
 *  - le compteur d'echecs par compte ci-dessous, qui bloque l'acharnement sur
 *    un compte precis meme depuis plusieurs adresses.
 *
 * Le message d'erreur reste identique que l'email existe ou non : cela evite de
 * reveler quelles adresses sont enregistrees.
 */
export const POST = publicRoute(
  async ({ body }) => {
    const headerList = await headers();
    const genericError = fail('UNAUTHORIZED', 'Email ou mot de passe incorrect.');

    const user = await prisma.user.findFirst({
      where: { email: body.email, deletedAt: null },
    });

    if (!user || !user.password) {
      /*
       * Comparaison factice volontaire.
       *
       * Sans elle, une adresse inconnue repond immediatement tandis qu'une
       * adresse existante attend le hachage bcrypt (~100 ms) : l'ecart de temps
       * suffit a determiner quels comptes existent, malgre un message d'erreur
       * identique. On paie donc le meme cout dans les deux cas.
       */
      await verifyPassword(body.password, DUMMY_HASH).catch(() => false);
      await audit({ action: 'LOGIN_FAILED', headers: headerList, meta: { email: body.email } });
      return genericError;
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      return fail('RATE_LIMITED', `Compte temporairement bloque. Reessayez dans ${minutes} minute(s).`);
    }

    const valid = await verifyPassword(body.password, user.password);

    if (!valid) {
      /*
       * Le compteur repart de zero une fois le verrouillage expire. Sans cette
       * remise a zero, il restait au-dessus du seuil et le moindre echec
       * ulterieur re-verrouillait le compte pour 15 minutes — une victime de
       * bourrage d'identifiants se retrouvait bloquee en permanence.
       */
      const lockExpired = user.lockedUntil !== null && user.lockedUntil <= new Date();
      const failedLoginCount = (lockExpired ? 0 : user.failedLoginCount) + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount,
          lockedUntil:
            failedLoginCount >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
        },
      });
      await audit({ action: 'LOGIN_FAILED', userId: user.id, headers: headerList });
      return genericError;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    await createSession(user);
    await audit({ action: 'LOGIN', userId: user.id, headers: headerList });

    return ok({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      locale: user.locale,
      theme: user.theme,
    });
  },
  { schema: loginSchema, rateLimit: { key: 'login', ...RATE_LIMITS.login } },
);
