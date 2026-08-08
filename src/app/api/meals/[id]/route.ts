import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { ok, ApiError } from '@/lib/api/response';
import { mealUpdateSchema } from '@/lib/validation/modules';
import { recomputeDay } from '@/lib/stats';

export const PATCH = route(
  async ({ user, params, body }) => {
    const existing = await prisma.meal.findFirst({
      where: { id: params.id, userId: user.id },
      select: { id: true, date: true },
    });
    if (!existing) throw new ApiError('NOT_FOUND', 'Repas introuvable.');

    const meal = await prisma.meal.update({ where: { id: params.id }, data: body });
    await recomputeDay(user.id, meal.date);
    return ok(meal);
  },
  { schema: mealUpdateSchema },
);

export const DELETE = route(async ({ user, params }) => {
  const meal = await prisma.meal.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true, date: true, isTemplate: true },
  });
  if (!meal) throw new ApiError('NOT_FOUND', 'Repas introuvable.');

  await prisma.meal.delete({ where: { id: params.id } });
  if (!meal.isTemplate) await recomputeDay(user.id, meal.date);

  return ok({ deleted: true });
});
