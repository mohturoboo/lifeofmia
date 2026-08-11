import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { ApiError, created, ok, sansUserId } from '@/lib/api/response';
import { weightSchema } from '@/lib/validation/modules';
import { bmi, bmiCategory, projectWeight } from '@/lib/stats';
import { recomputeDay } from '@/lib/stats';
import { awardXp, evaluateBadges } from '@/lib/gamification';
import { dateKeyIn } from '@/lib/date';
import { methodeRefusee, optionsPour, type MethodeHttp } from '@/lib/api/methodes';

/**
 * GET /api/weight
 *
 * Renvoie l'historique complet, l'IMC courant et une projection a 30 jours
 * obtenue par regression lineaire sur les mesures existantes.
 */
export const GET = route(async ({ user }) => {
  const today = dateKeyIn(user.timezone);

  /*
   * L'historique s'arrete a aujourd'hui.
   *
   * Le serveur refuse desormais les dates futures, mais une pesee datee de
   * 2027 avait pu etre enregistree avant ce garde-fou. Elle devenait la
   * derniere mesure — donc le « poids actuel » — et faussait la regression de
   * la projection. Le filtre ecarte ces lignes de toutes les lectures sans
   * detruire la donnee : l'utilisateur reste maitre de la supprimer.
   */
  const entries = await prisma.weightEntry.findMany({
    where: { userId: user.id, date: { lte: today } },
    orderBy: { date: 'asc' },
  });

  const goal = await prisma.goal.findFirst({
    where: { userId: user.id, status: 'active', unit: 'kg' },
    select: { targetValue: true, title: true },
  });

  const latest = entries[entries.length - 1] ?? null;
  const currentBmi = latest && user.heightCm ? bmi(latest.weightKg, user.heightCm) : null;

  /*
   * `sansUserId` : les lignes Prisma portent l'identifiant de leur
   * proprietaire, dont le client n'a aucun usage — chaque reponse le concerne
   * deja, par construction.
   */
  return ok({
    today,
    entries: entries.map(sansUserId),
    latest: latest ? sansUserId(latest) : null,
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
    /*
     * Une pesee ne se date pas dans le futur.
     *
     * Le formulaire posait deja `max` sur son champ date, mais cet attribut
     * n'est qu'une commodite de saisie : il ne protege rien. Un appel direct
     * datant une mesure de 2027 etait accepte, cette mesure devenait la plus
     * recente — donc le « poids actuel » affiche — et la regression lineaire
     * de la projection s'appuyait sur un point situe des annees plus loin que
     * tous les autres.
     *
     * La borne est calculee dans le fuseau du PROFIL : celui du navigateur
     * peut avancer d'un jour sur celui de l'utilisateur.
     */
    const today = dateKeyIn(user.timezone);
    if (body.date > today) {
      throw new ApiError('VALIDATION', 'Une pesee ne peut pas etre datee dans le futur.', {
        date: `La date ne peut pas depasser le ${today}.`,
      });
    }

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

    return created(sansUserId(entry));
  },
  { schema: weightSchema },
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
