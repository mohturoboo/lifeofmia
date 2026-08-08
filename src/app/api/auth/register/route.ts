import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { publicRoute } from '@/lib/api/handler';
import { created, fail } from '@/lib/api/response';
import { registerSchema } from '@/lib/validation/auth';
import { hashPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { issueToken, TOKEN_TYPES } from '@/lib/auth/tokens';
import { RATE_LIMITS } from '@/lib/auth/rate-limit';
import { sendMail, verificationEmail } from '@/lib/mailer';
import { seedUserWorkspace } from '@/lib/onboarding';
import { audit } from '@/lib/audit';

/**
 * POST /api/auth/register — creation d'un compte.
 *
 * Enchainement : validation, unicite de l'email, hash bcrypt, creation du
 * compte, mise en place de l'espace de depart, envoi du lien de verification,
 * puis ouverture immediate de la session (l'email non verifie n'empeche pas
 * l'usage, il est simplement signale dans l'interface).
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
        consentAt: new Date(),
      },
    });

    await seedUserWorkspace(user.id, body.city, body.mainGoal);

    const token = await issueToken(user.id, TOKEN_TYPES.EMAIL_VERIFICATION);
    await sendMail(verificationEmail(user.email, user.firstName, token));

    await createSession(user);
    await audit({ action: 'REGISTER', userId: user.id, headers: await headers() });

    return created({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      locale: user.locale,
      emailVerified: null,
    });
  },
  { schema: registerSchema, rateLimit: { key: 'register', ...RATE_LIMITS.register } },
);
