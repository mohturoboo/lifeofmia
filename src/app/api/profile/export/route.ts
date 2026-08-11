import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { RATE_LIMITS } from '@/lib/auth/rate-limit';
import { audit } from '@/lib/audit';
import { methodeRefusee, optionsPour, type MethodeHttp } from '@/lib/api/methodes';

/**
 * GET /api/profile/export — portabilite des donnees (RGPD, article 20).
 *
 * Renvoie l'integralite des donnees de l'utilisateur dans un fichier JSON
 * telechargeable. Le hash du mot de passe et les secrets 2FA sont exclus.
 */
export const GET = route(async ({ user }) => {
  const [profile, habits, habitLogs, tasks, goals, meals, waterLogs, weights, workouts, journal, prayers, transactions, projects, notes, events, focus, stats, badges, xpEvents] =
    await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: {
          id: true, email: true, firstName: true, lastName: true, country: true, city: true,
          timezone: true, locale: true, birthDate: true, gender: true, heightCm: true,
          mainGoal: true, xp: true, level: true, currentStreak: true, longestStreak: true,
          emailVerified: true, createdAt: true,
        },
      }),
      prisma.habit.findMany({ where: { userId: user.id } }),
      prisma.habitLog.findMany({ where: { userId: user.id } }),
      prisma.task.findMany({ where: { userId: user.id } }),
      prisma.goal.findMany({ where: { userId: user.id }, include: { steps: true } }),
      prisma.meal.findMany({ where: { userId: user.id } }),
      prisma.waterLog.findMany({ where: { userId: user.id } }),
      prisma.weightEntry.findMany({ where: { userId: user.id } }),
      prisma.workout.findMany({ where: { userId: user.id }, include: { exercises: true } }),
      prisma.journalEntry.findMany({ where: { userId: user.id } }),
      prisma.prayerLog.findMany({ where: { userId: user.id } }),
      prisma.transaction.findMany({ where: { userId: user.id } }),
      prisma.project.findMany({ where: { userId: user.id } }),
      prisma.note.findMany({ where: { userId: user.id } }),
      prisma.calendarEvent.findMany({ where: { userId: user.id } }),
      prisma.focusSession.findMany({ where: { userId: user.id } }),
      prisma.dailyStat.findMany({ where: { userId: user.id } }),
      prisma.userBadge.findMany({ where: { userId: user.id }, include: { badge: true } }),
      prisma.xpEvent.findMany({ where: { userId: user.id } }),
    ]);

  await audit({ action: 'DATA_EXPORT', userId: user.id, headers: await headers() });

  const payload = {
    exportedAt: new Date().toISOString(),
    application: 'LifeofM',
    format: 'json/v1',
    profile,
    habits,
    habitLogs,
    tasks,
    goals,
    meals,
    waterLogs,
    weights,
    workouts,
    journal,
    prayers,
    transactions,
    projects,
    notes,
    events,
    focusSessions: focus,
    dailyStats: stats,
    badges: badges.map((entry) => ({ code: entry.badge.code, name: entry.badge.name, unlockedAt: entry.unlockedAt })),
    xpEvents,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="lifeofm-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}, { rateLimit: { key: 'export', ...RATE_LIMITS.export } });

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
