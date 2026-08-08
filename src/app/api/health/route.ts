import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAiEnabled } from '@/lib/env';

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
