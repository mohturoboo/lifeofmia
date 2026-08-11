import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { created, ok, ApiError } from '@/lib/api/response';
import { taskCreateSchema } from '@/lib/validation/modules';
import { requireOwned } from '@/lib/api/ownership';
import { dateKeyIn, fromDateKey } from '@/lib/date';
import { parseStringArray, stringifyJson } from '@/lib/json';

/**
 * GET /api/tasks — liste filtrable.
 *   ?scope=today|week|month|overdue|undated|all   ?status=todo|doing|done|cancelled
 *   ?goalId=...   ?projectId=...
 */
const SCOPES = ['today', 'week', 'month', 'overdue', 'undated', 'all'] as const;
type Scope = (typeof SCOPES)[number];

export const GET = route(async ({ user, searchParams }) => {
  const demande = searchParams.get('scope') ?? 'all';

  /*
   * Un filtre inconnu est REFUSE, jamais ignore.
   *
   * `?scope=done` — un filtre qui n'existe pas — retombait sur « aucune borne
   * de date » et renvoyait donc TOUTES les taches. Une faute de frappe dans un
   * filtre produisait silencieusement le resultat le plus large possible, ce
   * qui est exactement l'inverse de ce qu'on attend d'un filtre.
   */
  if (!SCOPES.includes(demande as Scope)) {
    throw new ApiError('VALIDATION', `Filtre inconnu : « ${demande} ».`, {
      scope: `Valeurs acceptees : ${SCOPES.join(', ')}.`,
    });
  }
  const scope = demande as Scope;
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
    undated: undefined,
    all: undefined,
  };

  const tasks = await prisma.task.findMany({
    where: {
      userId: user.id,
      parentId: null, // les sous-taches sont renvoyees imbriquees
      /*
       * « Terminees » exige une date d'achevement : une tache marquee `done`
       * sans `completedAt` serait une incoherence, et l'inclure fausserait tout
       * decompte de productivite.
       */
      ...(status ? { status, ...(status === 'done' ? { completedAt: { not: null } } : {}) } : {}),
      ...(goalId ? { goalId } : {}),
      ...(projectId ? { projectId } : {}),
      /*
       * Les taches SANS echeance ont leur propre filtre.
       *
       * Elles apparaissaient auparavant dans « aujourd'hui », « semaine » ET
       * « mois » a la fois — un correctif trop large, pose pour qu'une tache
       * creee sans date ne disparaisse pas de l'ecran. Le resultat etait
       * trompeur : trois filtres censes decouper le temps renvoyaient tous la
       * meme chose. Elles sont desormais regroupees sous « sans echeance »,
       * que l'interface affiche a part pour qu'aucune ne soit perdue.
       */
      ...(scope === 'undated' ? { dueDate: null } : {}),
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
