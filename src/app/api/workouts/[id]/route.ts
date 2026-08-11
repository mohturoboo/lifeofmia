import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { ok, ApiError } from '@/lib/api/response';
import { workoutUpdateSchema } from '@/lib/validation/modules';
import { recomputeDay } from '@/lib/stats';
import { assertPasDansLeFutur } from '@/lib/api/intervalles';

export const PATCH = route(
  async ({ user, params, body }) => {
    const existing = await prisma.workout.findFirst({
      where: { id: params.id, userId: user.id },
      select: { id: true, date: true },
    });
    if (!existing) throw new ApiError('NOT_FOUND', 'Seance introuvable.');

    // Meme regle qu'a la creation : deplacer une seance ne doit pas permettre
    // de contourner la borne.
    if (body.date) assertPasDansLeFutur(body.date, user.timezone, 'date', 'Une seance');

    const { exercises, ...fields } = body;

    // Les exercices sont remplaces en bloc : plus simple et plus sur qu'une
    // reconciliation ligne a ligne pour une liste de cette taille.
    const workout = await prisma.workout.update({
      where: { id: params.id },
      data: {
        ...fields,
        ...(exercises
          ? {
              exercises: {
                deleteMany: {},
                create: exercises.map((exercise, index) => ({
                  name: exercise.name,
                  sets: exercise.sets,
                  reps: exercise.reps,
                  weightKg: exercise.weightKg ?? null,
                  restSec: exercise.restSec ?? null,
                  durationSec: exercise.durationSec ?? null,
                  position: index,
                })),
              },
            }
          : {}),
      },
      include: { exercises: { orderBy: { position: 'asc' } } },
    });

    await recomputeDay(user.id, workout.date);
    if (existing.date !== workout.date) await recomputeDay(user.id, existing.date);

    return ok(workout);
  },
  { schema: workoutUpdateSchema },
);

export const DELETE = route(async ({ user, params }) => {
  const workout = await prisma.workout.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true, date: true },
  });
  if (!workout) throw new ApiError('NOT_FOUND', 'Seance introuvable.');

  await prisma.workout.delete({ where: { id: params.id } });
  await recomputeDay(user.id, workout.date);

  return ok({ deleted: true });
});
