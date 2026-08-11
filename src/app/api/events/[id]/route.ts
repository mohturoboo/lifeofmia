import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { ok, ApiError } from '@/lib/api/response';
import { calendarEventUpdateSchema } from '@/lib/validation/modules';
import { assertIntervalle } from '@/lib/api/intervalles';

export const PATCH = route(
  async ({ user, params, body }) => {
    const existing = await prisma.calendarEvent.findFirst({
      where: { id: params.id, userId: user.id },
      select: { id: true, startAt: true, endAt: true },
    });
    if (!existing) throw new ApiError('NOT_FOUND', 'Evenement introuvable.');

    /*
     * La regle est verifiee sur le resultat de la fusion, pas sur le corps
     * envoye.
     *
     * Une modification partielle ne portant que sur `endAt` ne passait par
     * aucun controle : il suffisait de reculer la seule heure de fin pour
     * obtenir la duree negative que la creation refuse desormais. Comparer
     * l'envoi aux valeurs deja en base ferme cette porte.
     */
    const { startAt, endAt, ...fields } = body;
    const { debut, fin } = assertIntervalle(startAt ?? existing.startAt, endAt ?? existing.endAt);

    const event = await prisma.calendarEvent.update({
      where: { id: params.id },
      data: {
        ...fields,
        ...(startAt ? { startAt: debut } : {}),
        ...(endAt ? { endAt: fin } : {}),
      },
    });

    return ok(event);
  },
  { schema: calendarEventUpdateSchema },
);

export const DELETE = route(async ({ user, params }) => {
  const existing = await prisma.calendarEvent.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true },
  });
  if (!existing) throw new ApiError('NOT_FOUND', 'Evenement introuvable.');

  await prisma.calendarEvent.delete({ where: { id: params.id } });
  return ok({ deleted: true });
});
