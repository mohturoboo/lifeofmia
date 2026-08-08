import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { waterLogSchema } from '@/lib/validation/modules';
import { recomputeDay } from '@/lib/stats';

/**
 * POST /api/water — ajoute (ou retire, avec un montant negatif) de l'hydratation.
 * Le total du jour ne peut pas devenir negatif.
 */
export const POST = route(
  async ({ user, body }) => {
    await prisma.waterLog.create({
      data: { userId: user.id, date: body.date, amountMl: body.amountMl },
    });

    const total = await prisma.waterLog.aggregate({
      where: { userId: user.id, date: body.date },
      _sum: { amountMl: true },
    });

    const waterMl = Math.max(0, total._sum.amountMl ?? 0);
    await recomputeDay(user.id, body.date);

    return ok({ date: body.date, waterMl });
  },
  { schema: waterLogSchema },
);
