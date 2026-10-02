import { route } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { getDashboardData } from '@/lib/dashboard-data';
import { methodeRefusee, optionsPour, type MethodeHttp } from '@/lib/api/methodes';

/**
 * GET /api/dashboard
 *
 * Point d'entree unique du tableau de bord : une seule requete HTTP renvoie
 * tout ce que la page affiche. Les appels externes (meteo, horaires de priere)
 * sont lances en parallele et n'ont jamais le droit de faire echouer la
 * reponse — un `catch` les neutralise individuellement.
 */
export const GET = route(async ({ user }) => ok(await getDashboardData(user)));

// --- Methodes non prises en charge
//
// Sans handler declare, Next.js repond en HTML sous une URL qui promet du
// JSON : le client echouait sur « Unexpected token '<' ». Le 405 porte
// desormais le meme format que toutes les autres erreurs, et l'en-tete
// `Allow` annonce ce qui est accepte.
const AUTORISEES: MethodeHttp[] = ['GET'];
export const POST = methodeRefusee(AUTORISEES);
export const PUT = methodeRefusee(AUTORISEES);
export const PATCH = methodeRefusee(AUTORISEES);
export const DELETE = methodeRefusee(AUTORISEES);
export const OPTIONS = optionsPour(AUTORISEES);
