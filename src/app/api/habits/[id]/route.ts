import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { ok, ApiError, sansUserId } from '@/lib/api/response';
import { habitUpdateSchema } from '@/lib/validation/modules';
import { parseNumberArray, stringifyJson } from '@/lib/json';
import { methodeRefusee, optionsPour, type MethodeHttp } from '@/lib/api/methodes';

/**
 * Toutes les operations verifient `userId` dans la clause `where`, jamais
 * seulement l'identifiant : c'est ce qui garantit qu'un utilisateur ne peut pas
 * lire ou modifier l'habitude d'un autre en devinant un identifiant.
 */

async function assertOwnership(userId: string, habitId: string) {
  const habit = await prisma.habit.findFirst({
    where: { id: habitId, userId },
    select: { id: true },
  });
  if (!habit) throw new ApiError('NOT_FOUND', 'Habitude introuvable.');
}

/** PATCH /api/habits/[id] */
export const PATCH = route(
  async ({ user, params, body }) => {
    await assertOwnership(user.id, params.id);

    const data: Record<string, unknown> = {};
    for (const key of [
      'name', 'description', 'icon', 'color', 'category', 'frequency',
      'targetPerDay', 'unit', 'importance', 'xpReward', 'isNegative', 'position',
    ] as const) {
      if (body[key] !== undefined) data[key] = body[key];
    }
    if (body.weekDays !== undefined) data.weekDays = stringifyJson(body.weekDays);
    if (body.reminderAt !== undefined) data.reminderAt = body.reminderAt;
    if (body.archived !== undefined) data.archivedAt = body.archived ? new Date() : null;

    const habit = await prisma.habit.update({ where: { id: params.id }, data });
    return ok({ ...sansUserId(habit), weekDays: parseNumberArray(habit.weekDays) });
  },
  { schema: habitUpdateSchema },
);

/** DELETE /api/habits/[id] — supprime aussi tout l'historique (cascade). */
export const DELETE = route(async ({ user, params }) => {
  await assertOwnership(user.id, params.id);
  await prisma.habit.delete({ where: { id: params.id } });
  return ok({ deleted: true });
});

// --- Methodes non prises en charge
//
// Sans handler declare, Next.js repond en HTML sous une URL qui promet du
// JSON : le client echouait sur « Unexpected token '<' ». Le 405 porte
// desormais le meme format que toutes les autres erreurs, et l'en-tete
// `Allow` annonce ce qui est accepte.
const AUTORISEES: MethodeHttp[] = ['PATCH', 'DELETE'];
export const GET = methodeRefusee(AUTORISEES);
export const POST = methodeRefusee(AUTORISEES);
export const PUT = methodeRefusee(AUTORISEES);
export const OPTIONS = optionsPour(AUTORISEES);
