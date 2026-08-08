import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { created, ok } from '@/lib/api/response';
import { mealCreateSchema } from '@/lib/validation/modules';
import { dateKeyIn, isDateKey } from '@/lib/date';
import { recomputeDay } from '@/lib/stats';
import { awardXp } from '@/lib/gamification';

/**
 * GET /api/meals?date=YYYY-MM-DD
 * Renvoie les repas du jour, les totaux de macronutriments, l'hydratation et
 * les modeles enregistres par l'utilisateur.
 */
export const GET = route(async ({ user, searchParams }) => {
  const raw = searchParams.get('date');
  const date = isDateKey(raw) ? raw : dateKeyIn(user.timezone);

  const [meals, templates, water] = await Promise.all([
    prisma.meal.findMany({
      where: { userId: user.id, date, isTemplate: false },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.meal.findMany({
      where: { userId: user.id, isTemplate: true },
      orderBy: { createdAt: 'desc' },
      take: 40,
    }),
    prisma.waterLog.aggregate({ where: { userId: user.id, date }, _sum: { amountMl: true } }),
  ]);

  const totals = meals.reduce(
    (accumulator, meal) => ({
      calories: accumulator.calories + meal.calories * meal.quantity,
      protein: accumulator.protein + meal.protein * meal.quantity,
      carbs: accumulator.carbs + meal.carbs * meal.quantity,
      fat: accumulator.fat + meal.fat * meal.quantity,
      fiber: accumulator.fiber + meal.fiber * meal.quantity,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  );

  return ok({
    date,
    meals,
    templates,
    waterMl: water._sum.amountMl ?? 0,
    totals: {
      calories: Math.round(totals.calories),
      protein: Math.round(totals.protein),
      carbs: Math.round(totals.carbs),
      fat: Math.round(totals.fat),
      fiber: Math.round(totals.fiber),
    },
  });
});

/** POST /api/meals */
export const POST = route(
  async ({ user, body }) => {
    const meal = await prisma.meal.create({
      data: {
        userId: user.id,
        date: body.date,
        type: body.type,
        name: body.name,
        calories: body.calories,
        protein: body.protein,
        carbs: body.carbs,
        fat: body.fat,
        fiber: body.fiber,
        quantity: body.quantity,
        unit: body.unit,
        isTemplate: body.isTemplate,
        notes: body.notes,
      },
    });

    if (!body.isTemplate) {
      await recomputeDay(user.id, body.date);
      // Petite recompense : le suivi alimentaire est la donnee la plus souvent
      // abandonnee, il merite d'etre encourage.
      await awardXp(user.id, 3, 'Repas enregistre', 'habit');
    }

    return created(meal);
  },
  { schema: mealCreateSchema },
);
