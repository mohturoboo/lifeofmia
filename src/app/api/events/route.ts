import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { created, ok } from '@/lib/api/response';
import { calendarEventSchema } from '@/lib/validation/modules';

/**
 * GET /api/events?from=ISO&to=ISO
 *
 * Renvoie les evenements du calendrier ainsi que les taches datees de la
 * periode : l'agenda affiche les deux sur la meme grille, ce qui evite d'avoir
 * a consulter deux ecrans pour savoir ce qui est prevu.
 */
export const GET = route(async ({ user, searchParams }) => {
  const now = new Date();
  const from = new Date(searchParams.get('from') ?? new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const to = new Date(searchParams.get('to') ?? new Date(now.getFullYear(), now.getMonth() + 2, 0));

  const [events, tasks] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: { userId: user.id, startAt: { gte: from, lte: to } },
      orderBy: { startAt: 'asc' },
    }),
    prisma.task.findMany({
      where: { userId: user.id, dueDate: { gte: from, lte: to } },
      select: { id: true, title: true, dueDate: true, status: true, priority: true },
      orderBy: { dueDate: 'asc' },
    }),
  ]);

  return ok({ events, tasks });
});

export const POST = route(
  async ({ user, body }) => {
    const startAt = new Date(body.startAt);
    const endAt = new Date(body.endAt);

    const event = await prisma.calendarEvent.create({
      data: {
        userId: user.id,
        title: body.title,
        description: body.description,
        // Un evenement dont la fin precede le debut est corrige a une heure.
        startAt,
        endAt: endAt > startAt ? endAt : new Date(startAt.getTime() + 3_600_000),
        allDay: body.allDay,
        location: body.location,
        color: body.color,
      },
    });

    return created(event);
  },
  { schema: calendarEventSchema },
);
