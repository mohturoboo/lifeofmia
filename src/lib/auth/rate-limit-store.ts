import { prisma } from '@/lib/prisma';
import type { RateLimitResult } from '@/lib/auth/rate-limit';

/**
 * Limitation de debit PARTAGEE, adossee a la base.
 *
 * Le compteur en memoire de `rate-limit.ts` reste valable pour ce qui se passe
 * a l'interieur d'une instance — les ecritures d'un utilisateur deja
 * authentifie, par exemple. Il ne protege rien sur les routes publiques
 * deployees sans etat :
 *
 *  - Vercel repartit les invocations sur plusieurs instances, chacune avec sa
 *    propre `Map` : huit tentatives reparties sur quatre instances comptent
 *    pour deux chacune ;
 *  - un demarrage a froid repart d'un compteur vide ;
 *  - une instance inactive est recyclee, et le compteur avec elle.
 *
 * La protection annoncee sur la connexion existait donc dans le code sans
 * exister en production. Ce module la rend reelle en stockant les tentatives
 * la ou toutes les instances les voient.
 *
 * Le recul est exponentiel : chaque tentative refusee est enregistree elle
 * aussi, et le delai d'attente double a chaque fois. S'acharner coute de plus
 * en plus cher, alors qu'une erreur de frappe isolee ne coute rien.
 */

export interface BackoffOptions {
  /** Tentatives autorisees dans la fenetre. */
  limit: number;
  /** Duree de la fenetre glissante, en millisecondes. */
  windowMs: number;
  /** Attente imposee au premier refus, en secondes. */
  baseDelaySeconds?: number;
  /** Plafond de l'attente, en secondes. */
  maxDelaySeconds?: number;
}

const DEFAUT_BASE = 30;
const DEFAUT_PLAFOND = 60 * 60;

/** Au-dela de cette anciennete, une tentative n'interesse plus aucun compteur. */
const RETENTION_MS = 2 * 60 * 60_000;
const INTERVALLE_BALAYAGE_MS = 10 * 60_000;
let dernierBalayage = 0;

/**
 * Purge globale occasionnelle.
 *
 * La purge par compteur ne nettoie que les cles revisitees : celle d'une
 * adresse IP vue une seule fois resterait indefiniment. Ce balayage borne la
 * table sans peser sur le chemin critique — au plus une fois toutes les dix
 * minutes par instance, et son echec est sans consequence.
 */
async function balayerDeTempsEnTemps(): Promise<void> {
  const maintenant = Date.now();
  if (maintenant - dernierBalayage < INTERVALLE_BALAYAGE_MS) return;
  dernierBalayage = maintenant;

  await prisma.rateLimitHit
    .deleteMany({ where: { hitAt: { lt: new Date(maintenant - RETENTION_MS) } } })
    .catch(() => undefined);
}

/**
 * Consomme une tentative sur un compteur partage.
 *
 * En cas d'echec de la base, la tentative est AUTORISEE : une panne du
 * compteur ne doit pas fermer la porte a tout le monde. Le fait est
 * journalise, car un compteur muet est une protection absente.
 */
export async function consumePartage(
  bucket: string,
  options: BackoffOptions,
): Promise<RateLimitResult> {
  const {
    limit,
    windowMs,
    baseDelaySeconds = DEFAUT_BASE,
    maxDelaySeconds = DEFAUT_PLAFOND,
  } = options;

  const maintenant = Date.now();
  const debutFenetre = new Date(maintenant - windowMs);

  try {
    // Purge de la fenetre expiree pour ce seul compteur : borne la table sans
    // balayage global a chaque appel.
    await prisma.rateLimitHit.deleteMany({ where: { bucket, hitAt: { lt: debutFenetre } } });
    void balayerDeTempsEnTemps();

    const tentatives = await prisma.rateLimitHit.findMany({
      where: { bucket, hitAt: { gte: debutFenetre } },
      orderBy: { hitAt: 'asc' },
      select: { hitAt: true, blocked: true },
    });

    if (tentatives.length >= limit) {
      /*
       * Recul exponentiel : la premiere tentative refusee attend
       * `baseDelaySeconds`, la deuxieme le double, et ainsi de suite. Le
       * plafond evite qu'une erreur de configuration ne bloque un compte
       * pendant des jours.
       */
      const refus = tentatives.filter((tentative) => tentative.blocked).length;
      const attente = Math.min(maxDelaySeconds, baseDelaySeconds * 2 ** refus);

      // La tentative refusee est enregistree : c'est elle qui fait grandir
      // le delai suivant.
      await prisma.rateLimitHit.create({ data: { bucket, blocked: true } });

      const plusAncienne = tentatives[0]?.hitAt.getTime() ?? maintenant;
      const resteFenetre = Math.ceil((windowMs - (maintenant - plusAncienne)) / 1000);

      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.min(resteFenetre, attente) || attente),
      };
    }

    await prisma.rateLimitHit.create({ data: { bucket } });
    return { allowed: true, remaining: limit - tentatives.length - 1, retryAfterSeconds: 0 };
  } catch (error) {
    console.error('[rate-limit] compteur partage indisponible', error);
    return { allowed: true, remaining: limit, retryAfterSeconds: 0 };
  }
}

/** Efface un compteur : appele apres une connexion reussie. */
export async function reinitialiserPartage(bucket: string): Promise<void> {
  await prisma.rateLimitHit.deleteMany({ where: { bucket } }).catch(() => undefined);
}

/** Normalise une adresse email en cle de compteur. */
export function bucketCompte(prefixe: string, email: string): string {
  return `${prefixe}:compte:${email.trim().toLowerCase()}`;
}

export function bucketIp(prefixe: string, ip: string): string {
  return `${prefixe}:ip:${ip}`;
}
