/**
 * Remet un compte a l'etat d'une inscription toute fraiche.
 *
 *   npm run db:reset-account -- demo@lifeofm.app
 *
 * Le compte est CONSERVE (identifiants, profil, sessions ouvertes) mais toutes
 * les donnees produites par l'usage sont effacees, puis l'espace de depart est
 * reinstalle exactement comme le fait `POST /api/auth/register`.
 *
 * L'email est un argument obligatoire : sans lui le script s'arrete. C'est
 * volontaire — un script destructif ne doit jamais avoir de cible par defaut.
 */
import { PrismaClient } from '@prisma/client';
import { seedUserWorkspace } from '../src/lib/onboarding';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();

  if (!email) {
    console.error('Usage : npm run db:reset-account -- <email>');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, firstName: true, city: true, mainGoal: true },
  });

  if (!user) {
    console.error(`Aucun compte pour « ${email} ».`);
    process.exit(1);
  }

  console.log(`Remise a zero de ${user.email}...\n`);
  const userId = user.id;

  /*
   * Suppression des donnees d'usage.
   *
   * L'ordre suit les dependances : les enfants d'abord quand la cascade ne
   * suffit pas. `Exercise` part avec `Workout`, `AiMessage` avec
   * `AiConversation`, `HabitLog` avec `Habit` — mais on les supprime
   * explicitement pour que le decompte affiche soit exact.
   */
  const steps: Array<[string, () => Promise<{ count: number }>]> = [
    ['journaux d\'habitudes', () => prisma.habitLog.deleteMany({ where: { userId } })],
    ['habitudes', () => prisma.habit.deleteMany({ where: { userId } })],
    ['etapes d\'objectifs', () => prisma.goalStep.deleteMany({ where: { userId } })],
    ['taches', () => prisma.task.deleteMany({ where: { userId } })],
    ['objectifs', () => prisma.goal.deleteMany({ where: { userId } })],
    ['repas', () => prisma.meal.deleteMany({ where: { userId } })],
    ['hydratation', () => prisma.waterLog.deleteMany({ where: { userId } })],
    ['pesees', () => prisma.weightEntry.deleteMany({ where: { userId } })],
    ['seances de sport', () => prisma.workout.deleteMany({ where: { userId } })],
    ['sessions de concentration', () => prisma.focusSession.deleteMany({ where: { userId } })],
    ['entrees de journal', () => prisma.journalEntry.deleteMany({ where: { userId } })],
    ['prieres', () => prisma.prayerLog.deleteMany({ where: { userId } })],
    ['operations financieres', () => prisma.transaction.deleteMany({ where: { userId } })],
    ['notes', () => prisma.note.deleteMany({ where: { userId } })],
    ['projets', () => prisma.project.deleteMany({ where: { userId } })],
    ['evenements', () => prisma.calendarEvent.deleteMany({ where: { userId } })],
    ['statistiques quotidiennes', () => prisma.dailyStat.deleteMany({ where: { userId } })],
    ['badges obtenus', () => prisma.userBadge.deleteMany({ where: { userId } })],
    ['evenements XP', () => prisma.xpEvent.deleteMany({ where: { userId } })],
    ['notifications', () => prisma.notification.deleteMany({ where: { userId } })],
    ['conversations IA', () => prisma.aiConversation.deleteMany({ where: { userId } })],
    ['journal d\'audit', () => prisma.auditLog.deleteMany({ where: { userId } })],
  ];

  let total = 0;
  for (const [label, run] of steps) {
    const { count } = await run();
    total += count;
    if (count > 0) console.log(`  - ${String(count).padStart(5)} ${label}`);
  }

  // Reglages de priere : recrees juste apres par seedUserWorkspace.
  await prisma.prayerSettings.deleteMany({ where: { userId } });

  console.log(`\n  ${total} enregistrements supprimes`);

  // --- Remise a zero de la progression ---
  await prisma.user.update({
    where: { id: userId },
    data: {
      xp: 0,
      level: 1,
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });
  console.log('  Progression remise a zero : 0 XP, niveau 1, aucune serie');

  /*
   * Reinstallation de l'espace de depart.
   * On reutilise la fonction appelee a l'inscription plutot que d'en
   * reproduire le contenu : le resultat est garanti identique a celui d'un
   * compte reellement cree, et le restera si l'onboarding evolue.
   */
  await seedUserWorkspace(userId, user.city, user.mainGoal);

  const [habits, goals] = await Promise.all([
    prisma.habit.count({ where: { userId } }),
    prisma.goal.count({ where: { userId } }),
  ]);

  console.log(`  Espace de depart reinstalle : ${habits} habitudes, ${goals} objectif(s)\n`);
  console.log(`Le compte ${user.email} est a l'etat d'une inscription neuve.`);
}

main()
  .catch((error) => {
    console.error('Echec :', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
