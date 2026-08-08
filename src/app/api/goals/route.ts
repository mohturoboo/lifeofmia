import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { created, ok } from '@/lib/api/response';
import { goalCreateSchema } from '@/lib/validation/modules';
import { requireOwned } from '@/lib/api/ownership';

/** GET /api/goals — objectifs racines avec leurs etapes, sous-objectifs et taches. */
export const GET = route(async ({ user, searchParams }) => {
  const status = searchParams.get('status');
  const horizon = searchParams.get('horizon');

  const goals = await prisma.goal.findMany({
    where: {
      userId: user.id,
      parentId: null,
      ...(status ? { status } : {}),
      ...(horizon ? { horizon } : {}),
    },
    orderBy: [{ status: 'asc' }, { priority: 'desc' }, { deadline: 'asc' }],
    include: {
      steps: { orderBy: { position: 'asc' } },
      subgoals: { include: { steps: true } },
      tasks: { select: { id: true, title: true, status: true } },
    },
  });

  return ok(goals);
});

/**
 * POST /api/goals
 * Les etapes sont creees dans la meme transaction que l'objectif : un objectif
 * n'existe jamais sans son plan.
 */
export const POST = route(
  async ({ user, body }) => {
    // Un sous-objectif ne peut se rattacher qu'a un objectif de l'utilisateur.
    const parentId = await requireOwned('goal', body.parentId, user.id);

    const goal = await prisma.goal.create({
      data: {
        userId: user.id,
        title: body.title,
        description: body.description,
        category: body.category,
        horizon: body.horizon,
        priority: body.priority,
        status: body.status,
        targetValue: body.targetValue ?? null,
        currentValue: body.currentValue ?? null,
        unit: body.unit,
        deadline: body.deadline,
        parentId: parentId ?? null,
        color: body.color,
        steps: {
          create: body.steps.map((title, index) => ({ userId: user.id, title, position: index })),
        },
      },
      include: { steps: true },
    });

    return created(goal);
  },
  { schema: goalCreateSchema },
);
