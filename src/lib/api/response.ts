import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/**
 * Format de reponse unifie de l'API.
 *   succes : { data: ... }
 *   erreur  : { error: { code, message, fields? } }
 */

export const ERROR_CODES = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  METHOD_NOT_ALLOWED: 405,
  BAD_REQUEST: 400,
  SERVER_ERROR: 500,
  AI_DISABLED: 503,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export class ApiError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

export function created<T>(data: T): NextResponse {
  return NextResponse.json({ data }, { status: 201 });
}

export function fail(
  code: ErrorCode,
  message: string,
  fields?: Record<string, string>,
  extraHeaders?: Record<string, string>,
): NextResponse {
  return NextResponse.json(
    { error: { code, message, ...(fields ? { fields } : {}) } },
    { status: ERROR_CODES[code], headers: extraHeaders },
  );
}

/** Aplatit une erreur Zod en `{ champ: message }` exploitable par les formulaires. */
export function zodFields(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_';
    if (!fields[path]) fields[path] = issue.message;
  }
  return fields;
}

/**
 * Retire `userId` d'une ligne renvoyee au client.
 *
 * Renvoyer une ligne Prisma telle quelle expose l'identifiant de son
 * proprietaire. Le client n'en fait rien : chaque reponse concerne deja, par
 * construction, l'utilisateur authentifie qui la demande. C'est donc un
 * identifiant interne diffuse sans usage — et un identifiant diffuse finit par
 * etre utilise, puis par contraindre le schema.
 *
 * La fonction est volontairement typee pour SUPPRIMER la cle du type de
 * retour : oublier de la desormais appeler devient une erreur de compilation
 * la ou le champ etait attendu.
 */
export function sansUserId<T extends { userId?: unknown }>(ligne: T): Omit<T, 'userId'> {
  const { userId: _userId, ...reste } = ligne;
  return reste;
}
