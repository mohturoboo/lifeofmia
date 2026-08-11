import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { ok, fail } from '@/lib/api/response';
import { changePasswordSchema } from '@/lib/validation/auth';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { createSession, revokeAllSessions } from '@/lib/auth/session';
import { audit } from '@/lib/audit';
import { methodeRefusee, optionsPour, type MethodeHttp } from '@/lib/api/methodes';

/**
 * POST /api/profile/password — changement de mot de passe depuis les reglages.
 *
 * Toutes les sessions sont revoquees, puis une nouvelle est ouverte pour
 * l'appareil courant : les autres appareils sont deconnectes, celui-ci reste
 * utilisable sans nouvelle saisie.
 */
export const POST = route(
  async ({ user, body }) => {
    const record = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

    if (!record.password || !(await verifyPassword(body.currentPassword, record.password))) {
      return fail('UNAUTHORIZED', 'Mot de passe actuel incorrect.', {
        currentPassword: 'Mot de passe incorrect.',
      });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { password: await hashPassword(body.newPassword) },
    });

    await revokeAllSessions(user.id);
    await createSession(updated);
    await audit({ action: 'PASSWORD_CHANGE', userId: user.id, headers: await headers() });

    return ok({ success: true });
  },
  { schema: changePasswordSchema },
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
