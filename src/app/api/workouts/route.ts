import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { created, ok } from '@/lib/api/response';
import { workoutCreateSchema } from '@/lib/validation/modules';
import { dateKeyIn, lastNDays } from '@/lib/date';
import { recomputeDay } from '@/lib/stats';
import { assertPasDansLeFutur } from '@/lib/api/intervalles';
import { awardXp, evaluateBadges, refreshStreak } from '@/lib/gamification';
import { methodeRefusee, optionsPour, type MethodeHttp } from '@/lib/api/methodes';

/** GET /api/workouts — historique et statistiques agregees. */
export const GET = route(async ({ user, searchParams }) => {
  const limit = Math.min(200, Number(searchParams.get('limit') ?? 60));
  const today = dateKeyIn(user.timezone);
  const window = lastNDays(30, today);

  const [workouts, totals, monthly] = await Promise.all([
    prisma.workout.findMany({
      where: { userId: user.id },
      orderBy: { date: 'desc' },
      take: limit,
      include: { exercises: { orderBy: { position: 'asc' } } },
    }),
    prisma.workout.aggregate({
      where: { userId: user.id },
      _count: true,
      _sum: { durationMin: true, distanceKm: true, calories: true },
    }),
    prisma.workout.findMany({
      where: { userId: user.id, date: { gte: window[0] } },
      select: { date: true, durationMin: true, type: true },
    }),
  ]);

  // Repartition par type, utilisee par le graphique en anneau.
  const byType = monthly.reduce<Record<string, number>>((accumulator, workout) => {
    accumulator[workout.type] = (accumulator[workout.type] ?? 0) + workout.durationMin;
    return accumulator;
  }, {});

  return ok({
    workouts,
    totals: {
      sessions: totals._count,
      minutes: totals._sum.durationMin ?? 0,
      distanceKm: Math.round((totals._sum.distanceKm ?? 0) * 10) / 10,
      calories: Math.round(totals._sum.calories ?? 0),
    },
    byType,
    monthly: window.map((date) => ({
      date,
      minutes: monthly.filter((workout) => workout.date === date).reduce((sum, workout) => sum + workout.durationMin, 0),
    })),
  });
});

/** POST /api/workouts — seance + exercices en une seule ecriture. */
export const POST = route(
  async ({ user, body }) => {
    // Une seance decrit ce qui a ete fait : elle ne se date pas dans le futur.
    assertPasDansLeFutur(body.date, user.timezone, 'date', 'Une seance');

    const workout = await prisma.workout.create({
      data: {
        userId: user.id,
        date: body.date,
        name: body.name,
        type: body.type,
        durationMin: body.durationMin,
        distanceKm: body.distanceKm ?? null,
        calories: body.calories ?? null,
        avgHeartRate: body.avgHeartRate ?? null,
        intensity: body.intensity,
        notes: body.notes,
        exercises: {
          create: body.exercises.map((exercise, index) => ({
            name: exercise.name,
            sets: exercise.sets,
            reps: exercise.reps,
            weightKg: exercise.weightKg ?? null,
            restSec: exercise.restSec ?? null,
            durationSec: exercise.durationSec ?? null,
            position: index,
          })),
        },
      },
      include: { exercises: true },
    });

    await recomputeDay(user.id, body.date);
    // L'XP suit la duree, plafonnee : une seance de trois heures ne vaut pas
    // six fois une seance de trente minutes.
    await awardXp(user.id, Math.min(60, 15 + Math.floor(body.durationMin / 5)), `Seance : ${body.name}`, 'workout');
    await refreshStreak(user.id, user.timezone);
    await evaluateBadges(user.id);

    return created(workout);
  },
  { schema: workoutCreateSchema },
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
