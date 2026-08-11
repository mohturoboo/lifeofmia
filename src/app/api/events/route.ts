import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { created, ok } from '@/lib/api/response';
import { calendarEventSchema } from '@/lib/validation/modules';
import { assertIntervalle } from '@/lib/api/intervalles';

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
    /*
     * Le schema a deja refuse un intervalle invalide ; cet appel est la
     * seconde barriere et la source unique des objets `Date`.
     *
     * La route « corrigeait » auparavant une fin anterieure au debut en
     * imposant une duree d'une heure, puis repondait 201 : l'appelant croyait
     * son evenement enregistre tel quel, la base en contenait un autre.
     */
    const { debut: startAt, fin: endAt } = assertIntervalle(body.startAt, body.endAt);

    const event = await prisma.calendarEvent.create({
      data: {
        userId: user.id,
        title: body.title,
        description: body.description,
        startAt,
        endAt,
        allDay: body.allDay,
        location: body.location,
        color: body.color,
      },
    });

    return created(event);
  },
  { schema: calendarEventSchema },
);
