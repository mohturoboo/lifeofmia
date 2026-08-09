import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { publicRoute } from '@/lib/api/handler';
import { created, fail } from '@/lib/api/response';
import { registerSchema } from '@/lib/validation/auth';
import { hashPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { RATE_LIMITS } from '@/lib/auth/rate-limit';
import { seedUserWorkspace } from '@/lib/onboarding';
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
  async ({ body }) => {
    const existing = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true },
    });
    if (existing) {
      return fail('CONFLICT', 'Un compte existe deja avec cette adresse.', {
        email: 'Cette adresse est deja utilisee.',
      });
    }

    const birthDate = body.birthDate ? new Date(body.birthDate) : null;

    const user = await prisma.user.create({
      data: {
        email: body.email,
        password: await hashPassword(body.password),
        firstName: body.firstName,
        lastName: body.lastName,
        country: body.country,
        city: body.city,
        timezone: body.timezone,
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
