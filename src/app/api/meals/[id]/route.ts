import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { ok, ApiError } from '@/lib/api/response';
import { mealUpdateSchema } from '@/lib/validation/modules';
import { recomputeDay } from '@/lib/stats';
import { methodeRefusee, optionsPour, type MethodeHttp } from '@/lib/api/methodes';

/**
 * PATCH /api/meals/[id] — modifie un repas ou un modele.
 *
 * `date` et `saveAsTemplate` sont retires de la mise a jour : le premier
 * deplacerait le repas d'une journee a l'autre, le second n'est pas une colonne
 * mais une intention. `isTemplate` n'est meme pas accepte par le schema — une
 * modification ne doit jamais faire changer une ligne de nature.
 */
export const PATCH = route(
  async ({ user, params, body }) => {
    const existing = await prisma.meal.findFirst({
      where: { id: params.id, userId: user.id },
      select: { id: true, date: true, isTemplate: true },
    });
    if (!existing) throw new ApiError('NOT_FOUND', 'Repas introuvable.');

    const { saveAsTemplate, date: _ignoredDate, ...changes } = body;

    const meal = await prisma.meal.update({ where: { id: params.id }, data: changes });

    if (saveAsTemplate && !existing.isTemplate) {
      const { type, name, calories, protein, carbs, fat, fiber, quantity, unit, notes } = meal;
      const values = { type, name, calories, protein, carbs, fat, fiber, quantity, unit, notes };
      const template = await prisma.meal.findFirst({
        where: { userId: user.id, isTemplate: true, name: meal.name },
        select: { id: true },
      });

      if (template) await prisma.meal.update({ where: { id: template.id }, data: values });
      else await prisma.meal.create({ data: { userId: user.id, date: meal.date, isTemplate: true, ...values } });
    }

    if (!meal.isTemplate) await recomputeDay(user.id, meal.date);
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

// --- Methodes non prises en charge
//
// Sans handler declare, Next.js repond en HTML sous une URL qui promet du
// JSON : le client echouait sur « Unexpected token '<' ». Le 405 porte
// desormais le meme format que toutes les autres erreurs, et l'en-tete
// `Allow` annonce ce qui est accepte.
const AUTORISEES: MethodeHttp[] = ['PATCH', 'DELETE'];
export const GET = methodeRefusee(AUTORISEES);
export const POST = methodeRefusee(AUTORISEES);
export const PUT = methodeRefusee(AUTORISEES);
export const OPTIONS = optionsPour(AUTORISEES);
