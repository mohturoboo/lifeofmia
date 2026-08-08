import { headers } from 'next/headers';
import { publicRoute } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { destroySession, getCurrentUser } from '@/lib/auth/session';
import { audit } from '@/lib/audit';

/** POST /api/auth/logout — revoque la session courante et efface le cookie. */
export const POST = publicRoute(async () => {
  const user = await getCurrentUser().catch(() => null);
  await destroySession();
  if (user) await audit({ action: 'LOGOUT', userId: user.id, headers: await headers() });
  return ok({ success: true });
});
