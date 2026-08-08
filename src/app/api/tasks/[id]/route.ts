import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { ok, ApiError } from '@/lib/api/response';
import { taskUpdateSchema } from '@/lib/validation/modules';
import { rejectSelfReference, requireOwned } from '@/lib/api/ownership';
import { parseStringArray, stringifyJson } from '@/lib/json';
import { awardXp, evaluateBadges, refreshStreak } from '@/lib/gamification';
import { recomputeDay } from '@/lib/stats';
import { dateKeyIn, toDateKey } from '@/lib/date';

/**
 * PATCH /api/tasks/[id]
 *
 * Le passage a « termine » declenche l'XP et met a jour les statistiques du
 * jour d'echeance (ou du jour courant si la tache n'en avait pas). Le retour a
 * un statut non termine annule l'XP, pour que le score reste honnete.
 */
export const PATCH = route(
  async ({ user, params, body }) => {
    const existing = await prisma.task.findFirst({
      where: { id: params.id, userId: user.id },
      select: { id: true, status: true, xpReward: true, title: true, dueDate: true },
    });
    if (!existing) throw new ApiError('NOT_FOUND', 'Tache introuvable.');

    const data: Record<string, unknown> = {};
    for (const key of ['title', 'description', 'priority', 'status', 'estimateMin', 'xpReward'] as const) {
      if (body[key] !== undefined) data[key] = body[key];
    }

    // Reverification des cles etrangeres a chaque modification : une tache deja
    // creee ne doit pas pouvoir etre rattachee apres coup aux donnees d'autrui.
    rejectSelfReference(params.id, body.parentId, 'Une tache');
    const [parentId, goalId, projectId] = await Promise.all([
      requireOwned('task', body.parentId, user.id),
      requireOwned('goal', body.goalId, user.id),
      requireOwned('project', body.projectId, user.id),
    ]);
    if (parentId !== undefined) data.parentId = parentId;
    if (goalId !== undefined) data.goalId = goalId;
    if (projectId !== undefined) data.projectId = projectId;
    if (body.dueDate !== undefined) data.dueDate = body.dueDate;
    if (body.reminderAt !== undefined) data.reminderAt = body.reminderAt;
    if (body.tags !== undefined) data.tags = stringifyJson(body.tags);

    const becameDone = body.status === 'done' && existing.status !== 'done';
    const becameUndone = body.status !== undefined && body.status !== 'done' && existing.status === 'done';

    if (becameDone) data.completedAt = new Date();
    if (becameUndone) data.completedAt = null;

    const task = await prisma.task.update({ where: { id: params.id }, data });

    let xpAwarded = 0;
    if (becameDone) {
      xpAwarded = existing.xpReward;
      await awardXp(user.id, existing.xpReward, `Tache : ${existing.title}`, 'task');
      await refreshStreak(user.id, user.timezone);
      await evaluateBadges(user.id);
    } else if (becameUndone) {
      xpAwarded = -existing.xpReward;
      await awardXp(user.id, -existing.xpReward, `Annulation : ${existing.title}`, 'task');
    }

    if (becameDone || becameUndone) {
      const day = task.dueDate ? toDateKey(task.dueDate) : dateKeyIn(user.timezone);
      await recomputeDay(user.id, day);
    }

    return ok({ ...task, tags: parseStringArray(task.tags), xpAwarded });
  },
  { schema: taskUpdateSchema },
);

/** DELETE /api/tasks/[id] — supprime egalement les sous-taches (cascade). */
export const DELETE = route(async ({ user, params }) => {
  const task = await prisma.task.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true },
  });
  if (!task) throw new ApiError('NOT_FOUND', 'Tache introuvable.');

  await prisma.task.delete({ where: { id: params.id } });
  return ok({ deleted: true });
});
