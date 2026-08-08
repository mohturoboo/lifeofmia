/**
 * Limitation de debit en memoire (fenetre glissante).
 *
 * Suffisant pour un deploiement mono-instance et pour le developpement.
 * En production multi-instances, remplacez `store` par Redis / Upstash :
 * l'interface `consume()` reste identique, seul le backend change.
 */

interface Bucket {
  hits: number[];
}

const store = new Map<string, Bucket>();
let lastSweep = Date.now();

/** Nettoyage periodique pour eviter une croissance non bornee de la Map. */
function sweep(windowMs: number) {
  const now = Date.now();
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of store) {
    bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
    if (bucket.hits.length === 0) store.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function consume(key: string, limit: number, windowMs: number): RateLimitResult {
  sweep(windowMs);
  const now = Date.now();
  const bucket = store.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= limit) {
    store.set(key, bucket);
    const oldest = bucket.hits[0] ?? now;
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
    };
  }

  bucket.hits.push(now);
  store.set(key, bucket);
  return { allowed: true, remaining: limit - bucket.hits.length, retryAfterSeconds: 0 };
}

export function reset(key: string): void {
  store.delete(key);
}

/** Presets utilises par les routes sensibles. */
export const RATE_LIMITS = {
  login: { limit: 8, windowMs: 15 * 60_000 },
  register: { limit: 5, windowMs: 60 * 60_000 },
  passwordReset: { limit: 4, windowMs: 60 * 60_000 },
  ai: { limit: 40, windowMs: 60 * 60_000 },
  write: { limit: 300, windowMs: 60_000 },
  /** Lectures couteuses : export RGPD (vingt tables), statistiques annuelles. */
  export: { limit: 5, windowMs: 60 * 60_000 },
  analytics: { limit: 120, windowMs: 60_000 },
} as const;
