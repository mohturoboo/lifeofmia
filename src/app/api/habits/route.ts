import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { created, ok } from '@/lib/api/response';
import { habitCreateSchema } from '@/lib/validation/modules';
import { stringifyJson, parseNumberArray } from '@/lib/json';
import { dateKeyIn, lastNDays } from '@/lib/date';

/**
 * GET /api/habits — liste des habitudes avec leur historique recent.
 *
 * Les 30 derniers jours de journaux sont joints en une seule requete, ce qui
 * permet a l'interface d'afficher la serie et le taux de reussite de chaque
 * habitude sans appel supplementaire par ligne.
 */
export const GET = route(async ({ user, searchParams }) => {
  const includeArchived = searchParams.get('archived') === 'true';
  const today = dateKeyIn(user.timezone);
  const window = lastNDays(30, today);

  const habits = await prisma.habit.findMany({
    where: { userId: user.id, ...(includeArchived ? {} : { archivedAt: null }) },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    include: {
      logs: {
        where: { date: { gte: window[0] } },
        orderBy: { date: 'desc' },
        select: { date: true, status: true, count: true },
      },
    },
  });

  return ok(
    habits.map((habit) => {
      const done = new Set(habit.logs.filter((log) => log.status === 'done').map((log) => log.date));

      // Serie : nombre de jours consecutifs valides en remontant depuis aujourd'hui.
      let streak = 0;
      for (let index = window.length - 1; index >= 0; index -= 1) {
        if (done.has(window[index])) streak += 1;
        else if (window[index] !== today) break;
      }

      return {
        id: habit.id,
        name: habit.name,
        description: habit.description,
        icon: habit.icon,
        color: habit.color,
        category: habit.category,
        frequency: habit.frequency,
        weekDays: parseNumberArray(habit.weekDays),
        targetPerDay: habit.targetPerDay,
        unit: habit.unit,
        importance: habit.importance,
        xpReward: habit.xpReward,
        reminderAt: habit.reminderAt,
        isNegative: habit.isNegative,
        archived: habit.archivedAt !== null,
        position: habit.position,
        todayLog: habit.logs.find((log) => log.date === today) ?? null,
        streak,
        completionRate: Math.round((done.size / window.length) * 100),
        history: window.map((date) => ({ date, done: done.has(date) })),
      };
    }),
  );
});

/** POST /api/habits — creation. */
export const POST = route(
  async ({ user, body }) => {
    const last = await prisma.habit.findFirst({
      where: { userId: user.id },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const habit = await prisma.habit.create({
      data: {
        userId: user.id,
        name: body.name,
        description: body.description,
        icon: body.icon,
        color: body.color,
        category: body.category,
        frequency: body.frequency,
        weekDays: stringifyJson(body.weekDays),
        targetPerDay: body.targetPerDay,
        unit: body.unit,
        importance: body.importance,
        xpReward: body.xpReward,
        reminderAt: body.reminderAt ?? null,
        isNegative: body.isNegative,
        position: (last?.position ?? -1) + 1,
      },
    });

    return created({ ...habit, weekDays: parseNumberArray(habit.weekDays) });
  },
  { schema: habitCreateSchema },
);
