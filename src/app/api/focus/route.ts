import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { created } from '@/lib/api/response';
import { focusSessionSchema } from '@/lib/validation/modules';
import { requireOwned } from '@/lib/api/ownership';
import { recomputeDay } from '@/lib/stats';
import { assertPasDansLeFutur } from '@/lib/api/intervalles';
import { awardXp } from '@/lib/gamification';
import { methodeRefusee, optionsPour, type MethodeHttp } from '@/lib/api/methodes';

/**
 * POST /api/focus — enregistre une session de concentration.
 * Alimente le compteur « temps de concentration » du tableau de bord et le
 * calcul du score de discipline.
 */
export const POST = route(
  async ({ user, body }) => {
    // Une session de concentration se constate, elle ne se planifie pas :
    // datee de la semaine prochaine, elle offrait de l'XP pour un temps que
    // personne n'avait passe.
    assertPasDansLeFutur(body.date, user.timezone, 'date', 'Une session');

    const taskId = await requireOwned('task', body.taskId, user.id);

    const session = await prisma.focusSession.create({
      data: {
        userId: user.id,
        date: body.date,
        minutes: body.minutes,
        label: body.label,
        taskId: taskId ?? null,
      },
    });

    await recomputeDay(user.id, body.date);
    await awardXp(user.id, Math.min(40, Math.floor(body.minutes / 5)), 'Session de concentration', 'task');

    return created(session);
  },
  { schema: focusSessionSchema },
);

// --- Methodes non prises en charge
//
// Sans handler declare, Next.js repond en HTML sous une URL qui promet du
// JSON : le client echouait sur « Unexpected token '<' ». Le 405 porte
// desormais le meme format que toutes les autres erreurs, et l'en-tete
// `Allow` annonce ce qui est accepte.
const AUTORISEES: MethodeHttp[] = ['POST'];
export const GET = methodeRefusee(AUTORISEES);
export const PUT = methodeRefusee(AUTORISEES);
export const PATCH = methodeRefusee(AUTORISEES);
export const DELETE = methodeRefusee(AUTORISEES);
export const OPTIONS = optionsPour(AUTORISEES);
