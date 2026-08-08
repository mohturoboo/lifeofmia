import { NextResponse, type NextRequest } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { SESSION_COOKIE } from '@/lib/auth/constants';

/**
 * Middleware de routage (runtime Edge).
 *
 * Il ne fait qu'une chose : verifier la signature du jeton de session pour
 * decider d'une redirection. La revocation cote base est verifiee plus loin,
 * dans `requireUser()` — le middleware ne peut pas interroger la base depuis le
 * runtime Edge, et n'a pas besoin de le faire pour un simple aiguillage.
 */

/** Pages accessibles uniquement lorsqu'on n'est PAS connecte. */
const GUEST_ONLY = ['/login', '/register', '/forgot-password', '/reset-password'];

/** Prefixes proteges : toute autre page applicative exige une session. */
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/habits',
  '/tasks',
  '/goals',
  '/nutrition',
  '/weight',
  '/sport',
  '/journal',
  '/prayers',
  '/calendar',
  '/finance',
  '/notes',
  '/stats',
  '/compare',
  '/ai',
  '/settings',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const payload = token ? await verifyAccessToken(token) : null;
  const isAuthenticated = Boolean(payload);

  if (isAuthenticated && GUEST_ONLY.some((path) => pathname.startsWith(path))) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (!isAuthenticated && PROTECTED_PREFIXES.some((path) => pathname.startsWith(path))) {
    const loginUrl = new URL('/login', request.url);
    // Memorise la destination pour y revenir apres connexion.
    if (pathname !== '/dashboard') loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Exclut les assets statiques et les routes d'API (protegees par `route()`).
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)'],
};
