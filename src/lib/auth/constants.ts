/**
 * Constantes d'authentification sans dependance Node.
 *
 * Le middleware s'execute dans le runtime Edge, qui ne dispose pas de
 * `node:crypto`. Isoler ces valeurs ici permet au middleware de les importer
 * sans entrainer tout `lib/auth/session.ts` — et donc Prisma et le module
 * crypto — dans le bundle Edge.
 */

/** Nom du cookie httpOnly portant le jeton de session. */
export const SESSION_COOKIE = 'lifeofm_session';
