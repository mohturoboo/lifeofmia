import { z } from 'zod';
import { emailSchema, localeSchema, themeSchema, timeFormatSchema, unitsSchema } from '@/lib/validation/common';

export const passwordSchema = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caracteres.')
  .max(128, 'Le mot de passe est trop long.')
  .refine((value) => /[a-z]/.test(value), 'Ajoutez au moins une minuscule.')
  .refine((value) => /[A-Z]/.test(value), 'Ajoutez au moins une majuscule.')
  .refine((value) => /\d/.test(value), 'Ajoutez au moins un chiffre.');

export const registerSchema = z.object({
  firstName: z.string().trim().min(1, 'Prenom requis.').max(60),
  lastName: z.string().trim().min(1, 'Nom requis.').max(60),
  email: emailSchema(),
  password: passwordSchema,
  country: z.string().trim().min(2).max(60).default('FR'),
  city: z.string().trim().min(1).max(80).default('Paris'),
  timezone: z.string().trim().min(1).max(60).default('Europe/Paris'),
  locale: localeSchema.default('fr'),
  birthDate: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  mainGoal: z.string().trim().max(200).optional(),
  acceptTerms: z.literal(true, { error: 'Vous devez accepter les conditions.' }),
});

export const loginSchema = z.object({
  email: emailSchema(),
  password: z.string().min(1, 'Mot de passe requis.'),
  totp: z.string().length(6).optional(),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10, 'Jeton invalide.'),
  password: passwordSchema,
});

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().min(1).max(60).optional(),
  avatarUrl: z.string().max(500).nullable().optional(),
  country: z.string().trim().min(2).max(60).optional(),
  city: z.string().trim().min(1).max(80).optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  timezone: z.string().trim().min(1).max(60).optional(),
  locale: localeSchema.optional(),
  theme: themeSchema.optional(),
  timeFormat: timeFormatSchema.optional(),
  units: unitsSchema.optional(),
  birthDate: z.string().nullable().optional(),
  gender: z.enum(['male', 'female', 'other']).nullable().optional(),
  // Un verre courant fait 150 a 500 ml ; hors de ces bornes, c'est une
  // erreur de saisie plutot qu'un choix.
  glassMl: z.number().int().min(50, 'Entre 50 et 1000 ml.').max(1000, 'Entre 50 et 1000 ml.').optional(),
  heightCm: z
    .number()
    .min(50, 'La taille doit etre comprise entre 50 et 250 cm.')
    .max(250, 'La taille doit etre comprise entre 50 et 250 cm.')
    .nullable()
    .optional(),
  mainGoal: z.string().trim().max(200).nullable().optional(),
  marketingOptIn: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mot de passe actuel requis.'),
  newPassword: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
