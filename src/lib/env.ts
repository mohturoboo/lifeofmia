/**
 * Acces centralise et type aux variables d'environnement.
 * Toute lecture de `process.env` dans l'application passe par ici, ce qui rend
 * les dependances explicites et permet de detecter tot une config incomplete.
 */

/**
 * Valeur d'exemple publiee dans `.env.example` et dans le depot.
 * Elle ne doit JAMAIS servir en production : quiconque lit le code pourrait
 * forger un jeton de session valide et se faire passer pour n'importe qui.
 */
const INSECURE_PLACEHOLDER = 'dev-secret-change-me-in-production-please-32-chars-min';

/** Longueur minimale acceptable pour une cle de signature HS256. */
const MIN_SECRET_LENGTH = 32;

/**
 * Secret obligatoire en production, tolerant en developpement.
 *
 * Le controle porte sur `process.env[name]` et non sur la valeur deja resolue :
 * une version precedente testait la valeur APRES application du repli, qui
 * n'est jamais vide — la verification de production etait donc inatteignable,
 * et une application deployee sans `AUTH_SECRET` demarrait silencieusement
 * avec la cle d'exemple.
 *
 * L'evaluation est PARESSEUSE (cf. le getter plus bas). Une version precedente
 * la faisait a l'import du module : il suffisait qu'un composant client tire
 * `lib/env` par transitivite pour que le navigateur, ou aucun secret n'est
 * injecte, leve « AUTH_SECRET est absente » et casse l'hydratation de la page.
 */
function required(name: string, devFallback: string): string {
  if (typeof window !== 'undefined') {
    throw new Error(
      `${name} est un secret serveur : il ne doit jamais etre lu depuis le navigateur.`,
    );
  }

  const value = process.env[name]?.trim();

  if (process.env.NODE_ENV !== 'production') {
    return value && value.length > 0 ? value : devFallback;
  }

  if (!value) {
    throw new Error(
      `${name} est absente. Definissez-la dans les variables d'environnement de votre hebergeur.`,
    );
  }
  if (value === INSECURE_PLACEHOLDER) {
    throw new Error(
      `${name} utilise encore la valeur d'exemple, qui est publique. Generez-en une avec : ` +
        `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`,
    );
  }
  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(`${name} doit faire au moins ${MIN_SECRET_LENGTH} caracteres.`);
  }

  return value;
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

/** Le secret n'est valide qu'une fois, au premier acces. */
let authSecretCache: string | null = null;

export const env = {
  nodeEnv: optional('NODE_ENV', 'development'),
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',

  appUrl: optional('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),
  databaseUrl: optional('DATABASE_URL', 'file:./dev.db'),

  /** Lu a la demande, jamais a l'import : voir `required()`. */
  get authSecret(): string {
    authSecretCache ??= required('AUTH_SECRET', INSECURE_PLACEHOLDER);
    return authSecretCache;
  },
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
