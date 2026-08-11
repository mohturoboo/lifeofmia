import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { ok, ApiError } from '@/lib/api/response';
import { recomputeDay } from '@/lib/stats';
import { methodeRefusee, optionsPour, type MethodeHttp } from '@/lib/api/methodes';

export const DELETE = route(async ({ user, params }) => {
  const entry = await prisma.weightEntry.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true, date: true },
  });
  if (!entry) throw new ApiError('NOT_FOUND', 'Mesure introuvable.');

  await prisma.weightEntry.delete({ where: { id: params.id } });
  await recomputeDay(user.id, entry.date);

  return ok({ deleted: true });
});

// --- Methodes non prises en charge
//
// Sans handler declare, Next.js repond en HTML sous une URL qui promet du
// JSON : le client echouait sur « Unexpected token '<' ». Le 405 porte
// desormais le meme format que toutes les autres erreurs, et l'en-tete
// `Allow` annonce ce qui est accepte.
const AUTORISEES: MethodeHttp[] = ['DELETE'];
export const GET = methodeRefusee(AUTORISEES);
export const POST = methodeRefusee(AUTORISEES);
export const PUT = methodeRefusee(AUTORISEES);
export const PATCH = methodeRefusee(AUTORISEES);
export const OPTIONS = optionsPour(AUTORISEES);
