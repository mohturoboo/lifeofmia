import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { created, ok } from '@/lib/api/response';
import { weightSchema } from '@/lib/validation/modules';
import { bmi, bmiCategory, projectWeight } from '@/lib/stats';
import { recomputeDay } from '@/lib/stats';
import { awardXp, evaluateBadges } from '@/lib/gamification';

/**
 * GET /api/weight
 *
 * Renvoie l'historique complet, l'IMC courant et une projection a 30 jours
 * obtenue par regression lineaire sur les mesures existantes.
 */
export const GET = route(async ({ user }) => {
  const entries = await prisma.weightEntry.findMany({
    where: { userId: user.id },
    orderBy: { date: 'asc' },
  });

  const goal = await prisma.goal.findFirst({
    where: { userId: user.id, status: 'active', unit: 'kg' },
    select: { targetValue: true, title: true },
  });

  const latest = entries[entries.length - 1] ?? null;
  const currentBmi = latest && user.heightCm ? bmi(latest.weightKg, user.heightCm) : null;

  return ok({
    entries,
    latest,
    heightCm: user.heightCm,
    targetWeight: goal?.targetValue ?? null,
    bmi: currentBmi,
    bmiCategory: currentBmi ? bmiCategory(currentBmi) : null,
    forecast: projectWeight(
      entries.map((entry) => ({ date: entry.date, weightKg: entry.weightKg })),
      30,
    ),
  });
});

/**
 * POST /api/weight — enregistre une pesee.
 * Une seule mesure par jour : une nouvelle saisie remplace la precedente.
 */
export const POST = route(
  async ({ user, body }) => {
    const entry = await prisma.weightEntry.upsert({
      where: { userId_date: { userId: user.id, date: body.date } },
      create: {
        userId: user.id,
        date: body.date,
        weightKg: body.weightKg,
        bodyFat: body.bodyFat ?? null,
        muscleKg: body.muscleKg ?? null,
        photoUrl: body.photoUrl ?? null,
        note: body.note,
      },
      update: {
        weightKg: body.weightKg,
        bodyFat: body.bodyFat ?? null,
        muscleKg: body.muscleKg ?? null,
        photoUrl: body.photoUrl ?? null,
        note: body.note,
      },
    });

    await recomputeDay(user.id, body.date);
    await awardXp(user.id, 5, 'Pesee enregistree', 'weight');
    await evaluateBadges(user.id);

    return created(entry);
  },
  { schema: weightSchema },
);
