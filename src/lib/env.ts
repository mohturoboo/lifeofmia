/**
 * Acces centralise et type aux variables d'environnement.
 * Toute lecture de `process.env` dans l'application passe par ici, ce qui rend
 * les dependances explicites et permet de detecter tot une config incomplete.
 */

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Variable d'environnement manquante : ${name}`);
    }
    return fallback ?? '';
  }
  return value;
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

export const env = {
  nodeEnv: optional('NODE_ENV', 'development'),
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',

  appUrl: optional('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),
  databaseUrl: optional('DATABASE_URL', 'file:./dev.db'),

  authSecret: required('AUTH_SECRET', 'dev-secret-change-me-in-production-please-32-chars-min'),
  accessTokenTtl: optional('ACCESS_TOKEN_TTL', '15m'),
  refreshTokenTtlDays: Number(optional('REFRESH_TOKEN_TTL_DAYS', '30')),
  encryptionKey: optional('ENCRYPTION_KEY'),

  anthropicApiKey: optional('ANTHROPIC_API_KEY'),
  aiModel: optional('AI_MODEL', 'claude-sonnet-5'),

  smtpHost: optional('SMTP_HOST'),
  smtpPort: Number(optional('SMTP_PORT', '587')),
  smtpUser: optional('SMTP_USER'),
  smtpPassword: optional('SMTP_PASSWORD'),
  emailFrom: optional('EMAIL_FROM', 'LifeofM <no-reply@lifeofm.app>'),

  openWeatherApiKey: optional('OPENWEATHER_API_KEY'),
  aladhanApiUrl: optional('ALADHAN_API_URL', 'https://api.aladhan.com/v1'),
  nominatimUrl: optional('NOMINATIM_URL', 'https://nominatim.openstreetmap.org'),

  storageDriver: optional('STORAGE_DRIVER', 'local'),
} as const;

/** L'agent IA n'est actif que si une cle API est fournie. */
export const isAiEnabled = () => Boolean(env.anthropicApiKey);

/** Les emails partent reellement uniquement si un SMTP est configure. */
export const isSmtpConfigured = () => Boolean(env.smtpHost && env.smtpUser);
