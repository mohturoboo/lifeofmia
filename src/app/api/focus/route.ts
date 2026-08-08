import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { created } from '@/lib/api/response';
import { focusSessionSchema } from '@/lib/validation/modules';
import { requireOwned } from '@/lib/api/ownership';
import { recomputeDay } from '@/lib/stats';
import { awardXp } from '@/lib/gamification';

/**
 * POST /api/focus — enregistre une session de concentration.
 * Alimente le compteur « temps de concentration » du tableau de bord et le
 * calcul du score de discipline.
 */
export const POST = route(
  async ({ user, body }) => {
    const taskId = await requireOwned('task', body.taskId, user.id);

    const session = await prisma.focusSession.create({
      data: {
        userId: user.id,
        date: body.date,
        minutes: body.minutes,
        label: body.label,
        taskId: taskId ?? null,
      },
    });

    await recomputeDay(user.id, body.date);
    await awardXp(user.id, Math.min(40, Math.floor(body.minutes / 5)), 'Session de concentration', 'task');

    return created(session);
  },
  { schema: focusSessionSchema },
);
