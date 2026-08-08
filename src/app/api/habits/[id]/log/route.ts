import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { ok, ApiError } from '@/lib/api/response';
import { habitLogSchema } from '@/lib/validation/modules';
import { awardXp, evaluateBadges, refreshStreak } from '@/lib/gamification';
import { recomputeDay } from '@/lib/stats';

/**
 * POST /api/habits/[id]/log — valide (ou annule) une habitude pour une date.
 *
 * C'est l'action la plus frequente de l'application. Elle enchaine :
 *  1. l'ecriture du journal (upsert : une seule ligne par habitude et par jour) ;
 *  2. l'attribution d'XP, uniquement lors du passage a « fait » — repasser sur
 *     l'action ne doit pas permettre de farmer des points ;
 *  3. le recalcul de la serie et des badges ;
 *  4. le recalcul de l'instantane statistique du jour.
 */
export const POST = route(
  async ({ user, params, body }) => {
    const habit = await prisma.habit.findFirst({
      where: { id: params.id, userId: user.id },
      select: { id: true, targetPerDay: true, xpReward: true, name: true },
    });
    if (!habit) throw new ApiError('NOT_FOUND', 'Habitude introuvable.');

    const existing = await prisma.habitLog.findUnique({
      where: { habitId_date: { habitId: habit.id, date: body.date } },
      select: { id: true, status: true },
    });

    // `count` absent = « je valide l'objectif du jour ».
    const count = body.count ?? habit.targetPerDay;

    /*
     * Le statut « done » n'est accorde que si l'objectif quotidien est
     * reellement atteint. Sans cette regle, un compteur partiel (3 verres sur
     * 8) etait enregistre comme accompli et versait l'XP, alors que l'interface
     * et les statistiques le comptaient — a juste titre — comme non fait.
     */
    const reachedTarget = count >= habit.targetPerDay;
    const status = count <= 0 ? 'skipped' : reachedTarget ? body.status : 'skipped';
    const wasDone = existing?.status === 'done';
    const isDone = status === 'done';

    await prisma.habitLog.upsert({
      where: { habitId_date: { habitId: habit.id, date: body.date } },
      create: { userId: user.id, habitId: habit.id, date: body.date, count, status, note: body.note },
      update: { count, status, note: body.note },
    });

    let xpAwarded = 0;
    if (isDone && !wasDone) {
      xpAwarded = habit.xpReward;
      await awardXp(user.id, habit.xpReward, `Habitude : ${habit.name}`, 'habit');
    } else if (!isDone && wasDone) {
      // Retrait symetrique : annuler une validation retire l'XP correspondante.
      xpAwarded = -habit.xpReward;
      await awardXp(user.id, -habit.xpReward, `Annulation : ${habit.name}`, 'habit');
    }

    const [streak, stats, newBadges] = await Promise.all([
      isDone ? refreshStreak(user.id, user.timezone) : Promise.resolve(user.currentStreak),
      recomputeDay(user.id, body.date),
      isDone ? evaluateBadges(user.id) : Promise.resolve([]),
    ]);

    return ok({ status, count, xpAwarded, streak, stats, newBadges });
  },
  { schema: habitLogSchema },
);
