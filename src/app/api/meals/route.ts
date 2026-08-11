import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { created, ok } from '@/lib/api/response';
import { mealCreateSchema } from '@/lib/validation/modules';
import { dateKeyIn, isDateKey } from '@/lib/date';
import { recomputeDay } from '@/lib/stats';
import { awardXp } from '@/lib/gamification';
import { methodeRefusee, optionsPour, type MethodeHttp } from '@/lib/api/methodes';

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
    // Evite une requete de plus cote client pour une seule valeur de reglage.
    glassMl: user.glassMl,
    totals: {
      calories: Math.round(totals.calories),
      protein: Math.round(totals.protein),
      carbs: Math.round(totals.carbs),
      fat: Math.round(totals.fat),
      fiber: Math.round(totals.fiber),
    },
  });
});

/**
 * Enregistre un modele reutilisable a partir des valeurs d'un repas.
 *
 * Un modele portant deja ce nom est mis a jour plutot que duplique : sans ca,
 * recocher la case a chaque saisie du meme plat remplirait la liste de doublons
 * impossibles a distinguer.
 */
async function saveTemplate(
  userId: string,
  date: string,
  values: Omit<Prisma.MealUncheckedCreateInput, 'userId' | 'date' | 'isTemplate'>,
) {
  const existing = await prisma.meal.findFirst({
    where: { userId, isTemplate: true, name: values.name },
    select: { id: true },
  });

  if (existing) await prisma.meal.update({ where: { id: existing.id }, data: values });
  else await prisma.meal.create({ data: { userId, date, isTemplate: true, ...values } });
}

/**
 * POST /api/meals
 *
 * `saveAsTemplate` cree une copie reutilisable EN PLUS du repas, la ou
 * `isTemplate` cree une ligne qui n'est qu'un modele. La case « Enregistrer
 * comme modele » de l'interface pilote le premier : cocher la case ne doit pas
 * faire disparaitre le repas de la journee.
 */
export const POST = route(
  async ({ user, body }) => {
    const values = {
      type: body.type,
      name: body.name,
      calories: body.calories,
      protein: body.protein,
      carbs: body.carbs,
      fat: body.fat,
      fiber: body.fiber,
      quantity: body.quantity,
      unit: body.unit,
      notes: body.notes,
    };

    const meal = await prisma.meal.create({
      data: { userId: user.id, date: body.date, isTemplate: body.isTemplate, ...values },
    });

    if (body.saveAsTemplate && !body.isTemplate) {
      await saveTemplate(user.id, body.date, values);
    }

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

// --- Methodes non prises en charge
//
// Sans handler declare, Next.js repond en HTML sous une URL qui promet du
// JSON : le client echouait sur « Unexpected token '<' ». Le 405 porte
// desormais le meme format que toutes les autres erreurs, et l'en-tete
// `Allow` annonce ce qui est accepte.
const AUTORISEES: MethodeHttp[] = ['GET', 'POST'];
export const PUT = methodeRefusee(AUTORISEES);
export const PATCH = methodeRefusee(AUTORISEES);
export const DELETE = methodeRefusee(AUTORISEES);
export const OPTIONS = optionsPour(AUTORISEES);
