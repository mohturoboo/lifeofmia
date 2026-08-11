import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAiEnabled } from '@/lib/env';
import { methodeRefusee, optionsPour, type MethodeHttp } from '@/lib/api/methodes';

/**
 * GET /api/health — sonde de sante.
 *
 * Utilisee par le HEALTHCHECK Docker et par les plateformes d'hebergement.
 * Verifie que la base repond reellement, pas seulement que le processus tourne.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: 'ok',
      database: 'up',
      ai: isAiEnabled() ? 'enabled' : 'disabled',
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { status: 'error', database: 'down', timestamp: new Date().toISOString() },
      { status: 503 },
    );
  }
}

// --- Methodes non prises en charge
//
// Sans handler declare, Next.js repond en HTML sous une URL qui promet du
// JSON : le client echouait sur « Unexpected token '<' ». Le 405 porte
// desormais le meme format que toutes les autres erreurs, et l'en-tete
// `Allow` annonce ce qui est accepte.
const AUTORISEES: MethodeHttp[] = ['GET'];
export const POST = methodeRefusee(AUTORISEES);
export const PUT = methodeRefusee(AUTORISEES);
export const PATCH = methodeRefusee(AUTORISEES);
export const DELETE = methodeRefusee(AUTORISEES);
export const OPTIONS = optionsPour(AUTORISEES);
