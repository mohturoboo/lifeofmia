import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { ok, ApiError } from '@/lib/api/response';
import { calendarEventUpdateSchema } from '@/lib/validation/modules';

export const PATCH = route(
  async ({ user, params, body }) => {
    const existing = await prisma.calendarEvent.findFirst({
      where: { id: params.id, userId: user.id },
      select: { id: true },
    });
    if (!existing) throw new ApiError('NOT_FOUND', 'Evenement introuvable.');

    const { startAt, endAt, ...fields } = body;
    const event = await prisma.calendarEvent.update({
      where: { id: params.id },
      data: {
        ...fields,
        ...(startAt ? { startAt: new Date(startAt) } : {}),
        ...(endAt ? { endAt: new Date(endAt) } : {}),
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
