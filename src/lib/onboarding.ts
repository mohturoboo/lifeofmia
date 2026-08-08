import { prisma } from '@/lib/prisma';
import { BADGE_DEFINITIONS } from '@/lib/gamification';
import { stringifyJson } from '@/lib/json';
import { FALLBACK_CITIES } from '@/lib/weather';

/**
 * Mise en place de l'espace d'un nouvel utilisateur.
 *
 * Un compte vide est decourageant : on installe donc quelques habitudes de
 * depart, les reglages de priere et un premier objectif. L'utilisateur peut
 * tout modifier ou supprimer immediatement.
 */

/** Les badges sont globaux et partages : cette fonction est idempotente. */
export async function ensureBadges(): Promise<void> {
  const existing = await prisma.badge.count();
  if (existing >= BADGE_DEFINITIONS.length) return;

  for (const badge of BADGE_DEFINITIONS) {
    await prisma.badge
      .upsert({ where: { code: badge.code }, create: { ...badge }, update: {} })
      .catch(() => undefined);
  }
}

const STARTER_HABITS = [
  { name: 'Boire 2 L d\'eau', icon: 'droplet', color: '#5f9aa6', category: 'health', targetPerDay: 8, unit: 'verres', xpReward: 10 },
  { name: 'Lire 20 minutes', icon: 'book', color: '#8592ad', category: 'mind', targetPerDay: 1, xpReward: 15 },
  { name: 'Bouger 30 minutes', icon: 'dumbbell', color: '#c97f63', category: 'sport', targetPerDay: 1, xpReward: 20 },
  { name: 'Dormir avant 23 h', icon: 'moon', color: '#6e93a8', category: 'health', targetPerDay: 1, xpReward: 15 },
  { name: 'Pas de reseaux sociaux', icon: 'shield', color: '#d99a63', category: 'mind', targetPerDay: 1, xpReward: 20, isNegative: true },
];

export async function seedUserWorkspace(userId: string, city: string, mainGoal?: string | null): Promise<void> {
  await ensureBadges();

  const coordinates = FALLBACK_CITIES[city];
  if (coordinates) {
    await prisma.user.update({
      where: { id: userId },
      data: { latitude: coordinates.latitude, longitude: coordinates.longitude },
    });
  }

  await prisma.prayerSettings.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });

  await prisma.habit.createMany({
    data: STARTER_HABITS.map((habit, index) => ({
      userId,
      name: habit.name,
      icon: habit.icon,
      color: habit.color,
      category: habit.category,
      targetPerDay: habit.targetPerDay,
      unit: habit.unit ?? null,
      xpReward: habit.xpReward,
      isNegative: habit.isNegative ?? false,
      weekDays: stringifyJson([0, 1, 2, 3, 4, 5, 6]),
      position: index,
    })),
  });

  if (mainGoal && mainGoal.trim().length > 0) {
    await prisma.goal.create({
      data: {
        userId,
        title: mainGoal.trim().slice(0, 160),
        description: 'Objectif principal defini lors de l\'inscription.',
        horizon: 'long',
        priority: 'high',
        category: 'personal',
        steps: {
          create: [
            { userId, title: 'Definir les etapes concretes', position: 0 },
            { userId, title: 'Choisir les habitudes qui y menent', position: 1 },
            { userId, title: 'Fixer une premiere echeance', position: 2 },
          ],
        },
      },
    });
  }
}
