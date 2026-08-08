import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { ok, ApiError } from '@/lib/api/response';
import { transactionUpdateSchema } from '@/lib/validation/modules';

export const PATCH = route(
  async ({ user, params, body }) => {
    const existing = await prisma.transaction.findFirst({
      where: { id: params.id, userId: user.id },
      select: { id: true },
    });
    if (!existing) throw new ApiError('NOT_FOUND', 'Operation introuvable.');

    return ok(await prisma.transaction.update({ where: { id: params.id }, data: body }));
  },
  { schema: transactionUpdateSchema },
);

export const DELETE = route(async ({ user, params }) => {
  const existing = await prisma.transaction.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true },
  });
  if (!existing) throw new ApiError('NOT_FOUND', 'Operation introuvable.');

  await prisma.transaction.delete({ where: { id: params.id } });
  return ok({ deleted: true });
});
