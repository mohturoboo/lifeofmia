import { fail } from '@/lib/api/response';

/**
 * Filet de securite pour toute route `/api/**` inexistante.
 *
 * Sans lui, Next.js servait sa page 404 — du HTML complet — sous une URL dont
 * le prefixe promet du JSON. Tout client qui appelle `response.json()` echouait
 * alors sur « Unexpected token '<' », un message qui pointe vers un probleme de
 * parsing et non vers la vraie cause : le chemin n'existe pas. Onze chemins
 * plausibles etaient dans ce cas (/api/calendar, /api/nutrition, /api/sport,
 * /api/settings, /api/export...), tous nommes d'apres des pages reelles de
 * l'application, donc tous susceptibles d'etre essayes de bonne foi.
 *
 * Ce fichier est un attrape-tout : les routes reelles restent prioritaires,
 * Next.js resolvant toujours un segment litteral avant un segment dynamique.
 * Il ne repond donc que pour ce qui n'existe nulle part.
 *
 * `dynamic = 'force-dynamic'` : sans cela, la reponse pourrait etre mise en
 * cache a la construction pour un chemin donne, alors qu'elle depend
 * entierement du chemin demande.
 */
export const dynamic = 'force-dynamic';

const introuvable = async (
  _request: Request,
  contexte: { params: Promise<{ chemin?: string[] }> },
) => {
  const { chemin } = await contexte.params;
  const route = `/api/${(chemin ?? []).join('/')}`;

  return fail('NOT_FOUND', `La route ${route} n'existe pas.`);
};

export const GET = introuvable;
export const POST = introuvable;
export const PUT = introuvable;
export const PATCH = introuvable;
export const DELETE = introuvable;
export const HEAD = introuvable;
export const OPTIONS = introuvable;
