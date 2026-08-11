import { headers } from 'next/headers';
import { publicRoute } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { destroySession, getCurrentUser } from '@/lib/auth/session';
import { audit } from '@/lib/audit';
import { methodeRefusee, optionsPour, type MethodeHttp } from '@/lib/api/methodes';

/** POST /api/auth/logout — revoque la session courante et efface le cookie. */
export const POST = publicRoute(async () => {
  const user = await getCurrentUser().catch(() => null);
  await destroySession();
  if (user) await audit({ action: 'LOGOUT', userId: user.id, headers: await headers() });
  return ok({ success: true });
});

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
