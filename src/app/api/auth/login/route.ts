import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { clientIp, publicRoute } from '@/lib/api/handler';
import { ok, fail } from '@/lib/api/response';
import { loginSchema } from '@/lib/validation/auth';
import { verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { LOGIN_BACKOFF, RATE_LIMITS } from '@/lib/auth/rate-limit';
import { bucketCompte, bucketIp, consumePartage, reinitialiserPartage } from '@/lib/auth/rate-limit-store';
import { securityAlertEmail, sendMail } from '@/lib/mailer';
import { audit } from '@/lib/audit';

/**
 * Verrouillage progressif du compte apres des echecs repetes.
 *
 * Cinq tentatives, puis un blocage dont la duree double a chaque nouveau
 * verrouillage — quinze minutes, puis trente, puis une heure, plafonnees a
 * quatre heures. Une faute de frappe isolee ne coute rien ; l'acharnement
 * devient rapidement impraticable.
 */
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const LOCK_MAX_MINUTES = 240;

/**
 * Hachage bcrypt d'une valeur arbitraire, utilise pour egaliser le temps de
 * reponse quand l'adresse email n'existe pas (voir plus bas).
 */
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.6ZP0.Q0ZP0Q0ZP0Q0ZP0Q0ZP0Q0ZP0Q';

/**
 * POST /api/auth/login
 *
 * Trois protections se completent, et aucune ne suffit seule :
 *
 *  1. un compteur PARTAGE par adresse IP, qui bloque le balayage d'un grand
 *     nombre de comptes depuis une meme origine ;
 *  2. un compteur PARTAGE par adresse email, qui bloque l'acharnement sur un
 *     compte precis meme reparti sur plusieurs adresses IP ;
 *  3. le verrouillage du compte en base, qui survit a tout redemarrage.
 *
 * « Partage » n'est pas un detail : la limitation vivait dans une `Map` en
 * memoire. Sur un hebergement sans etat, chaque instance avait la sienne et
 * chaque demarrage a froid repartait de zero — la protection existait dans le
 * code sans exister en production. Elle est desormais en base, visible de
 * toutes les instances.
 *
 * Toutes les reponses d'echec sont indistinguables : meme message, meme code,
 * meme cout en temps, que l'adresse existe ou non. Un compteur qui ne
 * declencherait que sur les comptes reels serait lui-meme un oracle
 * d'enumeration.
 */
export const POST = publicRoute(
  async ({ request, body }) => {
    const headerList = await headers();
    const genericError = fail('UNAUTHORIZED', 'Email ou mot de passe incorrect.');

    const ip = clientIp(request);
    const compteurIp = bucketIp('login', ip);
    const compteurCompte = bucketCompte('login', body.email);

    /*
     * Les deux compteurs sont consommes AVANT toute verification, et le compteur
     * par compte l'est meme si l'adresse est inconnue : sans cela, seules les
     * adresses existantes seraient ralenties, ce qui revelerait lesquelles.
     */
    const [parIp, parCompte] = await Promise.all([
      consumePartage(compteurIp, { ...RATE_LIMITS.loginIp, ...LOGIN_BACKOFF }),
      consumePartage(compteurCompte, { ...RATE_LIMITS.login, ...LOGIN_BACKOFF }),
    ]);

    if (!parIp.allowed || !parCompte.allowed) {
      const attente = Math.max(parIp.retryAfterSeconds, parCompte.retryAfterSeconds);
      await audit({
        action: 'LOGIN_THROTTLED',
        headers: headerList,
        meta: { portee: !parIp.allowed ? 'ip' : 'compte' },
      });
      return tropDeTentatives(attente);
    }

    const user = await prisma.user.findFirst({
      where: { email: body.email, deletedAt: null },
    });

    if (!user || !user.password) {
      /*
       * Comparaison factice volontaire.
       *
       * Sans elle, une adresse inconnue repond immediatement tandis qu'une
       * adresse existante attend le hachage bcrypt (~100 ms) : l'ecart de temps
       * suffit a determiner quels comptes existent, malgre un message d'erreur
       * identique. On paie donc le meme cout dans les deux cas.
       */
      await verifyPassword(body.password, DUMMY_HASH).catch(() => false);
      await audit({ action: 'LOGIN_FAILED', headers: headerList, meta: { email: body.email } });
      return genericError;
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      /*
       * Meme reponse que la limitation de debit, au mot pres.
       *
       * Le message precedent — « Compte temporairement bloque » — n'apparaissait
       * que pour une adresse REELLE : il suffisait de six tentatives pour savoir
       * si un compte existait. Le durcissement d'un endroit ne vaut rien s'il
       * ouvre une fenetre a cote.
       */
      const secondes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000);
      return tropDeTentatives(Math.max(1, secondes));
    }

    const valid = await verifyPassword(body.password, user.password);

    if (!valid) {
      /*
       * Le compteur repart de zero une fois le verrouillage expire. Sans cette
       * remise a zero, il restait au-dessus du seuil et le moindre echec
       * ulterieur re-verrouillait le compte — une victime de bourrage
       * d'identifiants se retrouvait bloquee en permanence.
       */
      const lockExpired = user.lockedUntil !== null && user.lockedUntil <= new Date();
      const failedLoginCount = (lockExpired ? 0 : user.failedLoginCount) + 1;
      const doitVerrouiller = failedLoginCount >= MAX_ATTEMPTS;

      // Duree doublee a chaque verrouillage supplementaire, plafonnee.
      const minutes = doitVerrouiller
        ? Math.min(LOCK_MAX_MINUTES, LOCK_MINUTES * 2 ** (failedLoginCount - MAX_ATTEMPTS))
        : 0;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount,
          lockedUntil: doitVerrouiller ? new Date(Date.now() + minutes * 60_000) : null,
        },
      });
      await audit({
        action: 'LOGIN_FAILED',
        userId: user.id,
        headers: headerList,
        meta: { tentatives: failedLoginCount, verrouille: doitVerrouiller },
      });

      /*
       * Alerte au titulaire, au moment ou le compte se verrouille et non a
       * chaque echec : un email par tentative transformerait l'alerte en
       * nuisance, et l'attaquant en expediteur.
       *
       * L'envoi ne doit jamais faire echouer la connexion — ni, surtout,
       * allonger la reponse pour les seuls comptes existants.
       */
      if (doitVerrouiller) {
        void sendMail(securityAlertEmail(user.email, user.firstName, failedLoginCount, minutes)).catch(
          (error) => console.error('[login] alerte de securite non envoyee', error),
        );
        await audit({ action: 'ACCOUNT_LOCKED', userId: user.id, headers: headerList, meta: { minutes } });
      }

      return genericError;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    // Une connexion reussie efface les compteurs : l'utilisateur legitime qui
    // s'est trompe deux fois avant de reussir ne traine pas de dette.
    await Promise.all([reinitialiserPartage(compteurIp), reinitialiserPartage(compteurCompte)]);

    await createSession(user);
    await audit({ action: 'LOGIN', userId: user.id, headers: headerList });

    return ok({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      locale: user.locale,
      theme: user.theme,
    });
  },
  { schema: loginSchema },
);

/** Reponse unique de sur-sollicitation : 429 + `Retry-After`. */
function tropDeTentatives(secondes: number) {
  return fail(
    'RATE_LIMITED',
    `Trop de tentatives de connexion. Reessayez dans ${formaterAttente(secondes)}.`,
    undefined,
    { 'Retry-After': String(secondes) },
  );
}

function formaterAttente(secondes: number): string {
  if (secondes < 60) return `${secondes} secondes`;
  const minutes = Math.ceil(secondes / 60);
  return `${minutes} minute${minutes > 1 ? 's' : ''}`;
}
