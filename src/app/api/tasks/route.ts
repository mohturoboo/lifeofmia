import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { created, ok } from '@/lib/api/response';
import { taskCreateSchema } from '@/lib/validation/modules';
import { requireOwned } from '@/lib/api/ownership';
import { dateKeyIn, fromDateKey } from '@/lib/date';
import { parseStringArray, stringifyJson } from '@/lib/json';

/**
 * GET /api/tasks — liste filtrable.
 *   ?scope=today|week|month|overdue|all   ?status=todo|doing|done|cancelled
 *   ?goalId=...   ?projectId=...
 */
export const GET = route(async ({ user, searchParams }) => {
  const scope = searchParams.get('scope') ?? 'all';
  const status = searchParams.get('status');
  const goalId = searchParams.get('goalId');
  const projectId = searchParams.get('projectId');

  /*
   * Les bornes sont calculees dans le fuseau de l'utilisateur, pas dans celui
   * du serveur : avec `new Date()` local, un utilisateur a Tokyo consultant
   * « aujourd'hui » recevait la journee du serveur, decalee de plusieurs heures.
   */
  const today = dateKeyIn(user.timezone);
  const startOfToday = fromDateKey(today);
  startOfToday.setUTCHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday.getTime() + 86_400_000 - 1);

  const ranges: Record<string, { gte?: Date; lte?: Date } | undefined> = {
    today: { gte: startOfToday, lte: endOfToday },
    week: { gte: startOfToday, lte: new Date(startOfToday.getTime() + 7 * 86_400_000) },
    month: { gte: startOfToday, lte: new Date(startOfToday.getTime() + 30 * 86_400_000) },
    overdue: { lte: startOfToday },
    all: undefined,
  };

  const tasks = await prisma.task.findMany({
    where: {
      userId: user.id,
      parentId: null, // les sous-taches sont renvoyees imbriquees
      ...(status ? { status } : {}),
      ...(goalId ? { goalId } : {}),
      ...(projectId ? { projectId } : {}),
      ...(ranges[scope] ? { dueDate: ranges[scope] } : {}),
      ...(scope === 'overdue' ? { status: { in: ['todo', 'doing'] } } : {}),
    },
    orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { position: 'asc' }],
    include: {
      subtasks: { orderBy: { position: 'asc' } },
      goal: { select: { id: true, title: true, color: true } },
    },
  });

  return ok(
    tasks.map((task) => ({
      ...task,
      tags: parseStringArray(task.tags),
      subtasks: task.subtasks.map((subtask) => ({ ...subtask, tags: parseStringArray(subtask.tags) })),
    })),
  );
});

/** POST /api/tasks */
export const POST = route(
  async ({ user, body }) => {
    // Les cles etrangeres viennent du client : sans cette verification, une
    // tache pourrait etre rattachee a l'objectif ou a la tache d'un autre
    // utilisateur, et apparaitre dans SON interface.
    const [parentId, goalId, projectId] = await Promise.all([
      requireOwned('task', body.parentId, user.id),
      requireOwned('goal', body.goalId, user.id),
      requireOwned('project', body.projectId, user.id),
    ]);

    const task = await prisma.task.create({
      data: {
        userId: user.id,
        title: body.title,
        description: body.description,
        priority: body.priority,
        status: body.status,
        dueDate: body.dueDate,
        reminderAt: body.reminderAt,
        estimateMin: body.estimateMin ?? null,
        parentId: parentId ?? null,
        goalId: goalId ?? null,
        projectId: projectId ?? null,
        tags: stringifyJson(body.tags),
        xpReward: body.xpReward,
      },
    });
    return created({ ...task, tags: parseStringArray(task.tags) });
  },
  { schema: taskCreateSchema },
);
