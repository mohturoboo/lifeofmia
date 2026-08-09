import { z } from 'zod';

/** Briques de validation reutilisees par tous les modules. */

export const dateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date attendu : YYYY-MM-DD');

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Couleur hexadecimale invalide');

export const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Heure attendue au format HH:mm');

export const cuidSchema = z.string().min(1, 'Identifiant requis');

/**
 * Email normalise avant validation.
 *
 * L'ordre est important : `z.email().trim().toLowerCase()` validerait la chaine
 * BRUTE puis la normaliserait, ce qui rejette « ` Test@Exemple.fr ` » a cause
 * des espaces. Le `pipe` normalise d'abord, valide ensuite.
 */
export const emailSchema = (message = 'Adresse email invalide.') =>
  z.string().trim().toLowerCase().pipe(z.email(message));

export const tagsSchema = z.array(z.string().trim().min(1).max(32)).max(20).default([]);

/**
 * Derive un schema de mise a jour partielle a partir d'un schema de creation.
 *
 * `.partial()` ne suffit pas : une valeur par defaut y survit. Un champ absent
 * n'est pas « non fourni » mais « fourni avec sa valeur par defaut », et la
 * mise a jour l'ecrase. Renommer une habitude reinitialisait ainsi sa couleur,
 * sa frequence et ses jours ; epingler une note effacait son contenu.
 *
 * Les valeurs par defaut sont donc retirees avant de rendre les champs
 * optionnels : ce qui n'est pas envoye n'est pas touche.
 */
export function updatableFrom<Shape extends z.ZodRawShape>(schema: z.ZodObject<Shape>) {
  const shape = Object.fromEntries(
    Object.entries(schema.shape).map(([key, field]) => [
      key,
      field instanceof z.ZodDefault ? field.unwrap() : field,
    ]),
  ) as { [K in keyof Shape]: Shape[K] extends z.ZodDefault<infer Inner> ? Inner : Shape[K] };

  return z.object(shape).partial();
}

export const LOCALES = ['fr', 'en', 'ar', 'es', 'de', 'it', 'pt', 'tr'] as const;
export const localeSchema = z.enum(LOCALES);

export const themeSchema = z.enum(['dark', 'light', 'system']);
export const timeFormatSchema = z.enum(['12h', '24h']);
export const unitsSchema = z.enum(['metric', 'imperial']);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(200).default(50),
});

/** Convertit une chaine ISO (ou vide) en Date, en tolerant `null`. */
export const optionalDate = z
  .union([z.string(), z.date(), z.null()])
  .optional()
  .transform((value) => {
    if (value === null || value === undefined || value === '') return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  });

/** Chaine optionnelle nettoyee : '' devient null. */
export const optionalText = (max = 2000) =>
  z
    .union([z.string().max(max), z.null()])
    .optional()
    .transform((value) => {
      if (value === null || value === undefined) return null;
      const trimmed = value.trim();
      return trimmed === '' ? null : trimmed;
    });
