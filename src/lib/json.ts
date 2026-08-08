/**
 * Helpers de (de)serialisation JSON.
 * Le schema stocke les listes et objets sous forme de chaines pour rester
 * compatible SQLite et PostgreSQL ; ces fonctions encapsulent la conversion et
 * ne jettent jamais sur une donnee corrompue.
 */

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

export function stringifyJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return 'null';
  }
}

/** Liste de chaines stockee en JSON (tags, jours de la semaine...). */
export const parseStringArray = (value: string | null | undefined): string[] =>
  parseJson<string[]>(value, []).filter((item): item is string => typeof item === 'string');

export const parseNumberArray = (value: string | null | undefined): number[] =>
  parseJson<number[]>(value, []).filter((item): item is number => typeof item === 'number');
