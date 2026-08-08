import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { created, ok, ApiError } from '@/lib/api/response';
import { syncGoalProgress } from '@/lib/goals';

const createStepSchema = z.object({ title: z.string().trim().min(1).max(160) });

const updateStepSchema = z.object({
  stepId: z.string().min(1),
  done: z.boolean().optional(),
  title: z.string().trim().min(1).max(160).optional(),
  remove: z.boolean().optional(),
});

async function assertGoal(userId: string, goalId: string) {
  const goal = await prisma.goal.findFirst({ where: { id: goalId, userId }, select: { id: true } });
  if (!goal) throw new ApiError('NOT_FOUND', 'Objectif introuvable.');
}

/** POST /api/goals/[id]/steps — ajoute une etape. */
export const POST = route(
  async ({ user, params, body }) => {
    await assertGoal(user.id, params.id);

    const last = await prisma.goalStep.findFirst({
      where: { goalId: params.id },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const step = await prisma.goalStep.create({
      data: {
        userId: user.id,
        goalId: params.id,
        title: body.title,
        position: (last?.position ?? -1) + 1,
      },
    });

    return created({ step, progress: await syncGoalProgress(params.id) });
  },
  { schema: createStepSchema },
);

/**
 * PATCH /api/goals/[id]/steps — coche, renomme ou supprime une etape.
 * Dans tous les cas la progression de l'objectif est recalculee.
 */
export const PATCH = route(
  async ({ user, params, body }) => {
    await assertGoal(user.id, params.id);

    const step = await prisma.goalStep.findFirst({
      where: { id: body.stepId, goalId: params.id, userId: user.id },
      select: { id: true },
    });
    if (!step) throw new ApiError('NOT_FOUND', 'Etape introuvable.');

    if (body.remove) {
      await prisma.goalStep.delete({ where: { id: body.stepId } });
    } else {
      await prisma.goalStep.update({
        where: { id: body.stepId },
        data: {
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.done !== undefined ? { done: body.done, completedAt: body.done ? new Date() : null } : {}),
        },
      });
    }

    return ok({ progress: await syncGoalProgress(params.id) });
  },
  { schema: updateStepSchema },
);
