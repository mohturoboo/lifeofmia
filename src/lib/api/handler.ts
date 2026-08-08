import type { NextRequest, NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { ApiError, fail, zodFields } from '@/lib/api/response';
import { getCurrentUser, type SessionUser } from '@/lib/auth/session';
import { consume, RATE_LIMITS } from '@/lib/auth/rate-limit';
import { env } from '@/lib/env';

/**
 * Enveloppe commune a tous les route handlers.
 *
 * Elle centralise ce qui devrait sinon etre repete dans chaque fichier :
 *  - authentification et isolation stricte par utilisateur,
 *  - protection CSRF par verification d'origine sur les methodes mutantes,
 *  - limitation de debit,
 *  - validation Zod du corps de requete,
 *  - traduction des exceptions en reponses HTTP coherentes.
 */

export interface HandlerContext<TBody = unknown> {
  request: NextRequest;
  user: SessionUser;
  body: TBody;
  params: Record<string, string>;
  searchParams: URLSearchParams;
}

export interface PublicHandlerContext<TBody = unknown> {
  request: NextRequest;
  body: TBody;
  params: Record<string, string>;
  searchParams: URLSearchParams;
}

interface RouteOptions<TBody> {
  /** Schema de validation du corps JSON (methodes non-GET). */
  schema?: ZodType<TBody>;
  /** Cle et parametres de limitation de debit. */
  rateLimit?: { key: string; limit: number; windowMs: number };
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Verification d'origine : une requete mutante doit provenir de l'application.
 * Combinee au cookie `SameSite=Lax`, cela ferme la surface CSRF sans imposer
 * un jeton synchronise a chaque formulaire.
 */
function isSameOrigin(request: NextRequest): boolean {
  if (!MUTATING.has(request.method)) return true;

  const origin = request.headers.get('origin');
  if (!origin) return true; // requetes serveur-a-serveur / outils CLI

  let originHost: string;
  try {
    const parsed = new URL(origin);
    // Une origine explicitement autorisee suffit.
    if (parsed.origin === env.appUrl || parsed.origin === request.nextUrl.origin) return true;
    originHost = parsed.host;
  } catch {
    return false;
  }

  /*
   * Derriere un reverse proxy (Vercel, Railway, nginx), l'origine interne vue
   * par Next.js differe de l'origine publique envoyee par le navigateur. On
   * compare donc aussi l'hote de l'origine a celui annonce par la requete :
   * c'est la verification CSRF canonique, et elle reste sure car un site tiers
   * ne peut pas falsifier l'en-tete `Origin`.
   */
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = request.headers.get('host');
  return originHost === forwardedHost || originHost === host;
}

function clientKey(request: NextRequest, suffix: string): string {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'local';
  return `${suffix}:${ip}`;
}

async function readBody<TBody>(
  request: NextRequest,
  schema?: ZodType<TBody>,
): Promise<TBody> {
  if (!schema) return undefined as TBody;
  if (request.method === 'GET' || request.method === 'HEAD') return undefined as TBody;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    raw = {};
  }
  return schema.parse(raw);
}

function toResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return fail('VALIDATION', 'Certains champs sont invalides.', zodFields(error));
  }
  if (error instanceof ApiError) {
    return fail(error.code, error.message, error.fields);
  }
  if (error instanceof Error && error.name === 'UnauthorizedError') {
    return fail('UNAUTHORIZED', 'Authentification requise.');
  }
  console.error('[api] erreur non geree', error);
  return fail('SERVER_ERROR', 'Une erreur interne est survenue.');
}

type NextRouteArgs = { params: Promise<Record<string, string>> };

/** Route protegee : l'utilisateur authentifie est garanti non nul. */
export function route<TBody = unknown>(
  handler: (ctx: HandlerContext<TBody>) => Promise<NextResponse>,
  options: RouteOptions<TBody> = {},
) {
  return async (request: NextRequest, args?: NextRouteArgs): Promise<NextResponse> => {
    try {
      if (!isSameOrigin(request)) {
        return fail('FORBIDDEN', 'Origine de la requete non autorisee.');
      }

      const user = await getCurrentUser();
      if (!user) return fail('UNAUTHORIZED', 'Authentification requise.');

      /*
       * Une limite explicite s'applique a TOUTES les methodes, y compris `GET`.
       * Certaines lectures sont couteuses — l'export RGPD parcourt vingt tables,
       * les statistiques recalculent une annee — et n'etaient jusqu'ici bornees
       * par rien : un compte authentifie pouvait les marteler librement.
       * Sans limite explicite, seules les methodes mutantes sont bornees.
       */
      const limit =
        options.rateLimit ?? (MUTATING.has(request.method) ? { key: 'write', ...RATE_LIMITS.write } : null);

      if (limit) {
        const result = consume(`${limit.key}:${user.id}`, limit.limit, limit.windowMs);
        if (!result.allowed) {
          return fail('RATE_LIMITED', 'Trop de requetes, reessayez dans un instant.', undefined, {
            'Retry-After': String(result.retryAfterSeconds),
          });
        }
      }

      const body = await readBody(request, options.schema);
      const params = args?.params ? await args.params : {};

      return await handler({
        request,
        user,
        body,
        params,
        searchParams: request.nextUrl.searchParams,
      });
    } catch (error) {
      return toResponse(error);
    }
  };
}

/** Route publique : authentification, inscription, reinitialisation... */
export function publicRoute<TBody = unknown>(
  handler: (ctx: PublicHandlerContext<TBody>) => Promise<NextResponse>,
  options: RouteOptions<TBody> = {},
) {
  return async (request: NextRequest, args?: NextRouteArgs): Promise<NextResponse> => {
    try {
      if (!isSameOrigin(request)) {
        return fail('FORBIDDEN', 'Origine de la requete non autorisee.');
      }

      if (options.rateLimit) {
        const result = consume(
          clientKey(request, options.rateLimit.key),
          options.rateLimit.limit,
          options.rateLimit.windowMs,
        );
        if (!result.allowed) {
          return fail(
            'RATE_LIMITED',
            `Trop de tentatives. Reessayez dans ${result.retryAfterSeconds} secondes.`,
            undefined,
            { 'Retry-After': String(result.retryAfterSeconds) },
          );
        }
      }

      const body = await readBody(request, options.schema);
      const params = args?.params ? await args.params : {};

      return await handler({
        request,
        body,
        params,
        searchParams: request.nextUrl.searchParams,
      });
    } catch (error) {
      return toResponse(error);
    }
  };
}
