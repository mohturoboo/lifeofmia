import { prisma } from '@/lib/prisma';
import { ApiError } from '@/lib/api/response';

/**
 * Verification d'appartenance des references imbriquees.
 *
 * Une route peut proteger correctement sa propre ressource et rester vulnerable
 * par ses cles etrangeres : rattacher une tache au `goalId` d'un autre
 * utilisateur fait apparaitre son titre dans les objectifs de la victime.
 * C'est une faille de controle d'acces (OWASP A01), pas une simple incoherence.
 *
 * Toute cle etrangere fournie par le client passe donc par ces fonctions :
 * elles renvoient l'identifiant s'il appartient bien a l'utilisateur, `null`
 * s'il est absent, et levent `NOT_FOUND` s'il designe la ressource d'autrui —
 * jamais `FORBIDDEN`, qui confirmerait l'existence de la ressource.
 */

type Owned = 'goal' | 'task' | 'project';

const FINDERS: Record<Owned, (id: string, userId: string) => Promise<{ id: string } | null>> = {
  goal: (id, userId) => prisma.goal.findFirst({ where: { id, userId }, select: { id: true } }),
  task: (id, userId) => prisma.task.findFirst({ where: { id, userId }, select: { id: true } }),
  project: (id, userId) => prisma.project.findFirst({ where: { id, userId }, select: { id: true } }),
};

const LABELS: Record<Owned, string> = {
  goal: 'Objectif',
  task: 'Tache',
  project: 'Projet',
};

/**
 * Valide une reference optionnelle.
 * `undefined` signifie « champ non fourni », `null` « detacher la reference ».
 */
export async function requireOwned(
  kind: Owned,
  id: string | null | undefined,
  userId: string,
): Promise<string | null | undefined> {
  if (id === undefined) return undefined;
  if (id === null || id === '') return null;

  const found = await FINDERS[kind](id, userId);
  if (!found) throw new ApiError('NOT_FOUND', `${LABELS[kind]} introuvable.`);
  return found.id;
}

/**
 * Empeche qu'une ressource devienne son propre parent.
 * Sans cette garde, `parentId = id` cree un cycle qui fait boucler l'affichage
 * arborescent de l'interface.
 */
export function rejectSelfReference(id: string, parentId: string | null | undefined, label: string): void {
  if (parentId && parentId === id) {
    throw new ApiError('BAD_REQUEST', `${label} ne peut pas etre son propre parent.`);
  }
}
