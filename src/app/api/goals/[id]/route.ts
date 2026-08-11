import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { ok, ApiError } from '@/lib/api/response';
import { goalUpdateSchema } from '@/lib/validation/modules';
import { rejectSelfReference, requireOwned } from '@/lib/api/ownership';
import { awardXp, evaluateBadges } from '@/lib/gamification';
import { methodeRefusee, optionsPour, type MethodeHttp } from '@/lib/api/methodes';

/** PATCH /api/goals/[id] */
export const PATCH = route(
  async ({ user, params, body }) => {
    const existing = await prisma.goal.findFirst({
      where: { id: params.id, userId: user.id },
      select: { id: true, status: true, title: true },
    });
    if (!existing) throw new ApiError('NOT_FOUND', 'Objectif introuvable.');

    const data: Record<string, unknown> = {};
    for (const key of [
      'title', 'description', 'category', 'horizon', 'priority', 'status',
      'targetValue', 'currentValue', 'unit', 'color',
    ] as const) {
      if (body[key] !== undefined) data[key] = body[key];
    }
    if (body.deadline !== undefined) data.deadline = body.deadline;

    rejectSelfReference(params.id, body.parentId, 'Un objectif');
    const parentId = await requireOwned('goal', body.parentId, user.id);
    if (parentId !== undefined) data.parentId = parentId;

    const becameDone = body.status === 'done' && existing.status !== 'done';
    if (becameDone) {
      data.completedAt = new Date();
      data.progress = 100;
    }

    const goal = await prisma.goal.update({
      where: { id: params.id },
      data,
      include: { steps: { orderBy: { position: 'asc' } } },
    });

    if (becameDone) {
      // Un objectif atteint vaut nettement plus qu'une tache : c'est le geste
      // que l'application cherche a encourager.
      await awardXp(user.id, 200, `Objectif atteint : ${existing.title}`, 'goal');
      await evaluateBadges(user.id);
    }

    return ok(goal);
  },
  { schema: goalUpdateSchema },
);

/** DELETE /api/goals/[id] */
export const DELETE = route(async ({ user, params }) => {
  const goal = await prisma.goal.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true },
  });
  if (!goal) throw new ApiError('NOT_FOUND', 'Objectif introuvable.');

  await prisma.goal.delete({ where: { id: params.id } });
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
