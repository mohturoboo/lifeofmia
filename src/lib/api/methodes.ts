import { fail } from '@/lib/api/response';

/**
 * Reponses aux methodes HTTP non prises en charge.
 *
 * Sans handler declare, Next.js repond lui-meme — et il repond en HTML. Un
 * client qui appelle `GET /api/water` recevait une page complete la ou il
 * attendait du JSON : `response.json()` levait une erreur de syntaxe sur
 * « <!DOCTYPE », c'est-a-dire un message qui ne dit rien de la vraie faute.
 *
 * Le format est celui de toutes les autres erreurs de l'API, et l'en-tete
 * `Allow` — exige par la norme HTTP pour un 405 — annonce ce qui est accepte,
 * de sorte que la reponse se corrige elle-meme.
 */

export type MethodeHttp = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export function methodeRefusee(autorisees: MethodeHttp[]) {
  const allow = [...autorisees, 'OPTIONS'].join(', ');

  return async () =>
    fail(
      'METHOD_NOT_ALLOWED',
      `Méthode non autorisée sur cette ressource. Méthodes acceptées : ${autorisees.join(', ')}.`,
      undefined,
      { Allow: allow },
    );
}

/** Reponse a une requete `OPTIONS` : la norme attend 204 et un en-tete `Allow`. */
export function optionsPour(autorisees: MethodeHttp[]) {
  return async () =>
    new Response(null, {
      status: 204,
      headers: { Allow: [...autorisees, 'OPTIONS'].join(', ') },
    });
}
