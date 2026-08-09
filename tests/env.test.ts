/**
 * @vitest-environment jsdom
 *
 * Garde-fous autour de `AUTH_SECRET`.
 *
 * L'environnement est volontairement `jsdom` : `window` y est defini, ce qui
 * reproduit exactement le contexte navigateur ou la regression est apparue.
 * Un composant client tirait `lib/env` par transitivite, le module validait
 * `AUTH_SECRET` des l'import, et la page d'inscription cassait a l'hydratation
 * avec « AUTH_SECRET est absente » — alors que le secret ne doit jamais etre
 * envoye au navigateur.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const PLACEHOLDER = 'dev-secret-change-me-in-production-please-32-chars-min';
const VALID_SECRET = 'x'.repeat(48);

/** Recharge `lib/env` avec un environnement donne. */
async function loadEnv(overrides: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) vi.stubEnv(key, '');
    else vi.stubEnv(key, value);
  }
  return import('@/lib/env');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('lib/env — import cote navigateur', () => {
  it('s\'importe sans lever, meme en production et sans AUTH_SECRET', async () => {
    expect(typeof window).not.toBe('undefined');
    await expect(loadEnv({ NODE_ENV: 'production', AUTH_SECRET: undefined })).resolves.toBeDefined();
  });

  it('laisse lire les valeurs publiques dans le navigateur', async () => {
    const { env } = await loadEnv({
      NODE_ENV: 'production',
      AUTH_SECRET: undefined,
      NEXT_PUBLIC_APP_URL: 'https://exemple.app',
    });
    expect(env.appUrl).toBe('https://exemple.app');
  });

  it('refuse de livrer le secret au navigateur, meme s\'il est defini', async () => {
    const { env } = await loadEnv({ NODE_ENV: 'production', AUTH_SECRET: VALID_SECRET });
    expect(() => env.authSecret).toThrow(/ne doit jamais etre lu depuis le navigateur/);
  });
});

describe('lib/env — validation du secret cote serveur', () => {
  /** Simule le serveur en retirant `window` pendant l'appel. */
  function onServer<T>(run: () => T): T {
    const original = globalThis.window;
    // @ts-expect-error suppression volontaire pour reproduire le runtime Node
    delete globalThis.window;
    try {
      return run();
    } finally {
      globalThis.window = original;
    }
  }

  it('bloque le demarrage si AUTH_SECRET est absente', async () => {
    const { env } = await loadEnv({ NODE_ENV: 'production', AUTH_SECRET: undefined });
    expect(() => onServer(() => env.authSecret)).toThrow(/est absente/);
  });

  it('bloque la valeur d\'exemple publiee dans le depot', async () => {
    const { env } = await loadEnv({ NODE_ENV: 'production', AUTH_SECRET: PLACEHOLDER });
    expect(() => onServer(() => env.authSecret)).toThrow(/valeur d'exemple/);
  });

  it('bloque une cle trop courte pour une signature HS256', async () => {
    const { env } = await loadEnv({ NODE_ENV: 'production', AUTH_SECRET: 'trop-court' });
    expect(() => onServer(() => env.authSecret)).toThrow(/32 caracteres/);
  });

  it('accepte une cle reelle', async () => {
    const { env } = await loadEnv({ NODE_ENV: 'production', AUTH_SECRET: VALID_SECRET });
    expect(onServer(() => env.authSecret)).toBe(VALID_SECRET);
  });

  it('tolere l\'absence de secret hors production', async () => {
    const { env } = await loadEnv({ NODE_ENV: 'development', AUTH_SECRET: undefined });
    expect(onServer(() => env.authSecret)).toBe(PLACEHOLDER);
  });
});
