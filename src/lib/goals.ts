import { prisma } from '@/lib/prisma';

/**
 * Logique metier des objectifs.
 *
 * Cette fonction vivait dans `app/api/goals/[id]/route.ts` et etait importee
 * par la route des etapes. Importer un module de route depuis un autre force
 * Next.js a evaluer ses handlers exportes et melange transport et metier :
 * la logique reutilisable appartient a `lib/`.
 */

/**
 * Recalcule la progression d'un objectif a partir de ses etapes.
 * Sans etape, la valeur saisie manuellement est conservee : un objectif sans
 * plan reste pilote a la main plutot que force a zero.
 */
export async function syncGoalProgress(goalId: string): Promise<number> {
  const steps = await prisma.goalStep.findMany({ where: { goalId }, select: { done: true } });

  if (steps.length === 0) {
    const goal = await prisma.goal.findUnique({ where: { id: goalId }, select: { progress: true } });
    return goal?.progress ?? 0;
  }

  const progress = Math.round((steps.filter((step) => step.done).length / steps.length) * 100);
  await prisma.goal.update({ where: { id: goalId }, data: { progress } });
  return progress;
}
