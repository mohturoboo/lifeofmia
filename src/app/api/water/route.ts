import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { waterLogSchema } from '@/lib/validation/modules';
import { recomputeDay } from '@/lib/stats';
import { methodeRefusee, optionsPour, type MethodeHttp } from '@/lib/api/methodes';

/**
 * POST /api/water — ajoute (ou retire, avec un montant negatif) de l'hydratation.
 * Le total du jour ne peut pas devenir negatif.
 *
 * Le total est lu dans le resultat de `recomputeDay()`, qui agrege deja
 * l'hydratation du jour. Une version precedente faisait la meme agregation
 * juste avant : un aller-retour reseau de plus vers la base pour une valeur
 * qu'on obtenait de toute facon.
 */
export const POST = route(
  async ({ user, body }) => {
    /*
     * Un retrait est borne au total deja enregistre. Sans cette borne, retirer
     * un verre a 0 ml inscrivait -250 ml : l'affichage restait a 0, mais le
     * verre suivant ne faisait que compenser la dette et le total ne bougeait
     * pas.
     */
    let amountMl = body.amountMl;
    if (amountMl < 0) {
      const { _sum } = await prisma.waterLog.aggregate({
        where: { userId: user.id, date: body.date },
        _sum: { amountMl: true },
      });
      amountMl = Math.max(amountMl, -Math.max(0, _sum.amountMl ?? 0));
    }

    if (amountMl !== 0) {
      await prisma.waterLog.create({
        data: { userId: user.id, date: body.date, amountMl },
      });
    }

    const stats = await recomputeDay(user.id, body.date);

    return ok({ date: body.date, waterMl: Math.max(0, stats.waterMl) });
  },
  { schema: waterLogSchema },
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
