import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { ok, ApiError } from '@/lib/api/response';
import { recomputeDay } from '@/lib/stats';

export const DELETE = route(async ({ user, params }) => {
  const entry = await prisma.weightEntry.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true, date: true },
  });
  if (!entry) throw new ApiError('NOT_FOUND', 'Mesure introuvable.');

  await prisma.weightEntry.delete({ where: { id: params.id } });
  await recomputeDay(user.id, entry.date);

  return ok({ deleted: true });
});
