import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { clientIp, publicRoute } from '@/lib/api/handler';
import { created, fail } from '@/lib/api/response';
import { registerSchema } from '@/lib/validation/auth';
import { hashPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { LOGIN_BACKOFF, RATE_LIMITS } from '@/lib/auth/rate-limit';
import { bucketIp, consumePartage } from '@/lib/auth/rate-limit-store';
import { seedUserWorkspace } from '@/lib/onboarding';
import { FALLBACK_CITIES } from '@/lib/cities';
import { audit } from '@/lib/audit';

/**
 * POST /api/auth/register — creation d'un compte.
 *
 * Enchainement : validation, unicite de l'email, hash bcrypt, creation du
 * compte, mise en place de l'espace de depart, puis ouverture immediate de la
 * session.
 *
 * Il n'y a pas de verification d'adresse email : le compte est utilisable
 * des sa creation. `emailVerified` est donc renseigne immediatement — le champ
 * reste dans le schema pour ne pas casser l'export RGPD et pour pouvoir
 * reintroduire la verification plus tard sans migration.
 */
export const POST = publicRoute(
  async ({ request, body }) => {
    /*
     * Compteur PARTAGE par adresse IP, en plus de celui de l'enveloppe.
     *
     * Celui de l'enveloppe vit en memoire : sur un hebergement sans etat, il ne
     * survit ni au demarrage a froid ni a la repartition sur plusieurs
     * instances. C'est celui-ci qui borne reellement la creation massive de
     * comptes.
     */
    const compteur = bucketIp('register', clientIp(request));
    const debit = await consumePartage(compteur, { ...RATE_LIMITS.register, ...LOGIN_BACKOFF });
    if (!debit.allowed) {
      return fail(
        'RATE_LIMITED',
        `Trop de creations de compte depuis cette adresse. Reessayez dans ${Math.ceil(debit.retryAfterSeconds / 60)} minute(s).`,
        undefined,
        { 'Retry-After': String(debit.retryAfterSeconds) },
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true },
    });
    if (existing) {
      /*
       * POSTURE ASSUMEE : l'inscription dit clairement qu'une adresse est deja
       * prise, la reinitialisation de mot de passe reste generique.
       *
       * L'asymetrie est voulue, pas un oubli. Sans verification d'adresse email
       * — retiree a la demande du produit — une inscription ne PEUT PAS etre
       * rendue non enumerable : soit elle annonce le conflit, soit elle laisse
       * croire a une creation qui n'a pas eu lieu, et l'utilisateur legitime se
       * retrouve devant un compte introuvable. Le silence protegerait
       * l'attaquant et punirait l'utilisateur.
       *
       * La reinitialisation, elle, ne paie aucun prix a rester generique :
       * « si un compte existe, un email part » est vrai et suffisant dans les
       * deux cas. Elle reste donc durcie.
       *
       * Ce qui est enumerable ici est donc borne par le debit, seul levier
       * disponible : cinq essais par heure et par adresse IP, avec recul
       * exponentiel. Rendre l'inscription reellement muette suppose de
       * retablir la verification par email — c'est une decision produit, pas
       * un correctif.
       */
      return fail('CONFLICT', 'Un compte existe deja avec cette adresse.', {
        email: 'Cette adresse est deja utilisee.',
      });
    }

    const birthDate = body.birthDate ? new Date(body.birthDate) : null;

    /*
     * Le fuseau suit la ville declaree, pas le navigateur.
     *
     * Le formulaire envoyait `Intl.DateTimeFormat().resolvedOptions().timeZone`,
     * c'est-a-dire le reglage de l'appareil. Quelqu'un choisissant « Paris »
     * depuis un telephone regle sur Casablanca se retrouvait avec des
     * coordonnees parisiennes et un fuseau marocain — une incoherence qui
     * decale silencieusement toutes les heures affichees.
     */
    const ville = FALLBACK_CITIES[body.city];

    const user = await prisma.user.create({
      data: {
        email: body.email,
        password: await hashPassword(body.password),
        firstName: body.firstName,
        lastName: body.lastName,
        country: body.country,
        city: body.city,
        timezone: ville?.timezone ?? body.timezone,
        latitude: ville?.latitude ?? null,
        longitude: ville?.longitude ?? null,
        locale: body.locale,
        gender: body.gender ?? null,
        birthDate: birthDate && !Number.isNaN(birthDate.getTime()) ? birthDate : null,
        mainGoal: body.mainGoal?.trim() || null,
        emailVerified: new Date(),
        consentAt: new Date(),
      },
    });

    await seedUserWorkspace(user.id, body.city, body.mainGoal);
    await createSession(user);
    await audit({ action: 'REGISTER', userId: user.id, headers: await headers() });

    return created({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      locale: user.locale,
    });
  },
  { schema: registerSchema, rateLimit: { key: 'register', ...RATE_LIMITS.register } },
);
