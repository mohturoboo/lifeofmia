'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Client HTTP de l'application.
 *
 * Toutes les reponses suivent le contrat `{ data }` / `{ error }` defini dans
 * `lib/api/response.ts` : ce module le traduit en promesses qui resolvent la
 * donnee ou rejettent une `ApiClientError` exploitable par les formulaires.
 */

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
    public readonly status?: number,
    /**
     * Secondes a attendre avant de reessayer, lues dans l'en-tete
     * `Retry-After`.
     *
     * Le serveur repondait deja 429 avec cet en-tete, mais le client le
     * jetait : l'interface affichait « Trop de tentatives » sans jamais dire
     * combien de temps, ce qui pousse a reessayer en boucle — exactement le
     * comportement que la limitation cherche a decourager.
     */
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

/** `Retry-After` en secondes, quel que soit son format. */
function lireRetryAfter(response: Response): number | undefined {
  const brut = response.headers.get('Retry-After');
  if (!brut) return undefined;

  const secondes = Number(brut);
  if (Number.isFinite(secondes)) return Math.max(0, Math.round(secondes));

  // La norme autorise aussi une date HTTP.
  const date = Date.parse(brut);
  return Number.isNaN(date) ? undefined : Math.max(0, Math.round((date - Date.now()) / 1000));
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      credentials: 'same-origin',
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
      ...init,
    });
  } catch {
    throw new ApiClientError('NETWORK', 'Connexion impossible. Verifiez votre reseau.');
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = payload?.error;
    throw new ApiClientError(
      error?.code ?? 'SERVER_ERROR',
      error?.message ?? 'Une erreur est survenue.',
      error?.fields,
      response.status,
      lireRetryAfter(response),
    );
  }

  return payload?.data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

/**
 * Hook de lecture avec rechargement manuel.
 * Suffisant ici : les vues sont majoritairement journalieres et se rafraichissent
 * apres chaque mutation via `refresh()`, sans necessiter un cache global.
 */
export function useResource<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState<string | null>(null);
  // Evite qu'une reponse lente ecrase une reponse plus recente.
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (!path) {
      setLoading(false);
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<T>(path);
      if (id === requestId.current) setData(result);
    } catch (caught) {
      if (id === requestId.current) {
        setError(caught instanceof ApiClientError ? caught.message : 'Erreur inconnue');
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, refresh: load, setData };
}
