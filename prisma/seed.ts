/**
 * Jeu de donnees de demonstration.
 *
 * Cree un compte complet avec 90 jours d'historique realiste : c'est ce qui
 * permet de voir immediatement les graphiques, la heatmap, les series et la
 * page de comparaison remplis, plutot qu'une application vide.
 *
 *   npm run db:seed
 *
 * Identifiants : demo@lifeofm.app / Demo1234
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const BADGES = [
  { code: 'first_step', name: 'Premier pas', description: 'Valider sa toute premiere habitude', icon: 'sparkles', tier: 'bronze', xpReward: 25 },
  { code: 'week_streak', name: 'Une semaine', description: "7 jours consecutifs d'activite", icon: 'flame', tier: 'bronze', xpReward: 50 },
  { code: 'month_streak', name: 'Un mois de fer', description: "30 jours consecutifs d'activite", icon: 'flame', tier: 'silver', xpReward: 200 },
  { code: 'century_streak', name: 'Centurion', description: "100 jours consecutifs d'activite", icon: 'crown', tier: 'gold', xpReward: 800 },
  { code: 'year_streak', name: 'Immuable', description: "365 jours consecutifs d'activite", icon: 'crown', tier: 'platinum', xpReward: 3000 },
  { code: 'task_master', name: 'Executant', description: 'Terminer 100 taches', icon: 'check', tier: 'silver', xpReward: 150 },
  { code: 'goal_achiever', name: 'Visionnaire', description: 'Atteindre 5 objectifs', icon: 'target', tier: 'gold', xpReward: 300 },
  { code: 'iron_body', name: "Corps d'acier", description: 'Enregistrer 50 seances de sport', icon: 'dumbbell', tier: 'gold', xpReward: 300 },
  { code: 'devoted', name: 'Assidu', description: '100 prieres enregistrees', icon: 'moon', tier: 'gold', xpReward: 300 },
  { code: 'scribe', name: 'Le scribe', description: '30 entrees de journal', icon: 'book', tier: 'silver', xpReward: 150 },
  { code: 'level_10', name: 'Niveau 10', description: 'Atteindre le niveau 10', icon: 'award', tier: 'silver', xpReward: 100 },
  { code: 'level_25', name: 'Niveau 25', description: 'Atteindre le niveau 25', icon: 'award', tier: 'gold', xpReward: 400 },
  { code: 'transformation', name: 'Transformation', description: 'Perdre ou gagner 5 kg vers son objectif', icon: 'trending', tier: 'gold', xpReward: 400 },
];

const HABITS = [
  { name: 'Priere du Fajr', icon: 'moon', color: '#dcc7ea', category: 'spirituality', targetPerDay: 1, xpReward: 20, reliability: 0.82 },
  { name: 'Lire 30 minutes', icon: 'book', color: '#d9c7f0', category: 'mind', targetPerDay: 1, xpReward: 15, reliability: 0.68 },
  { name: 'Boire 2 L d\'eau', icon: 'droplet', color: '#e6e6e6', category: 'health', targetPerDay: 8, unit: 'verres', xpReward: 10, reliability: 0.75 },
  { name: 'Seance de sport', icon: 'dumbbell', color: '#ff9fbf', category: 'sport', targetPerDay: 1, xpReward: 25, reliability: 0.55 },
  { name: 'Dormir avant 23 h', icon: 'moon', color: '#e9b8d5', category: 'health', targetPerDay: 1, xpReward: 15, reliability: 0.6 },
  { name: 'Pas de reseaux sociaux', icon: 'shield', color: '#ff9fbf', category: 'mind', targetPerDay: 1, xpReward: 20, reliability: 0.45, isNegative: true },
  { name: 'Travail sur mon business', icon: 'zap', color: '#fbc7da', category: 'work', targetPerDay: 1, xpReward: 25, reliability: 0.72 },
];

const DAYS = 90;

/** Generateur pseudo-aleatoire deterministe : le seed produit toujours la meme demo. */
function makeRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const random = makeRandom(20260807);

function dayKey(offset: number): string {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

async function main() {
  console.log('Seed en cours...');

  // --- Badges (globaux) ---
  for (const badge of BADGES) {
    await prisma.badge.upsert({ where: { code: badge.code }, create: badge, update: badge });
  }
  console.log(`  ${BADGES.length} badges installes`);

  // --- Compte de demonstration (recree a chaque execution) ---
  const email = 'demo@lifeofm.app';
  await prisma.user.deleteMany({ where: { email } });

  const user = await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash('Demo1234', 12),
      firstName: 'Mohamed',
      lastName: 'Demo',
      country: 'France',
      city: 'Paris',
      latitude: 48.8566,
      longitude: 2.3522,
      timezone: 'Europe/Paris',
      locale: 'fr',
      theme: 'dark',
      heightCm: 178,
      gender: 'male',
      birthDate: new Date('1998-04-12'),
      mainGoal: 'Perdre 10 kg et construire une discipline inebranlable',
      emailVerified: new Date(),
      consentAt: new Date(),
      currentStreak: 23,
      longestStreak: 41,
      lastActiveDate: dayKey(0),
      prayerSettings: { create: { method: 3, school: 0 } },
    },
  });
  console.log(`  Compte cree : ${email} / Demo1234`);

  // --- Habitudes ---
  const habits = [];
  for (const [index, definition] of HABITS.entries()) {
    habits.push(
      await prisma.habit.create({
        data: {
          userId: user.id,
          name: definition.name,
          icon: definition.icon,
          color: definition.color,
          category: definition.category,
          targetPerDay: definition.targetPerDay,
          unit: definition.unit ?? null,
          xpReward: definition.xpReward,
          isNegative: definition.isNegative ?? false,
          weekDays: JSON.stringify([0, 1, 2, 3, 4, 5, 6]),
          position: index,
        },
      }),
    );
  }

  // --- Historique sur 90 jours ---
  // La fiabilite augmente legerement avec le temps : la page « Comparaison »
  // montre ainsi une vraie progression plutot qu'un bruit aleatoire.
  const habitLogs: Array<{ userId: string; habitId: string; date: string; count: number; status: string }> = [];
  const prayerLogs: Array<{ userId: string; date: string; name: string; status: string }> = [];
  const dailyStats = [];
  const weights = [];
  const meals = [];
  const waterLogs = [];
  const workouts = [];
  const focusSessions = [];
  const journalEntries = [];

  let weight = 88.4;

  for (let offset = DAYS - 1; offset >= 0; offset -= 1) {
    const date = dayKey(offset);
    const progressFactor = 0.75 + ((DAYS - offset) / DAYS) * 0.3; // 0.75 -> 1.05

    let habitsDone = 0;
    for (const [index, habit] of habits.entries()) {
      const definition = HABITS[index];
      const succeeded = random() < Math.min(0.95, definition.reliability * progressFactor);
      if (succeeded) habitsDone += 1;

      habitLogs.push({
        userId: user.id,
        habitId: habit.id,
        date,
        count: succeeded ? habit.targetPerDay : Math.floor(habit.targetPerDay * random()),
        status: succeeded ? 'done' : 'skipped',
      });
    }

    // Prieres
    let prayersDone = 0;
    for (const name of ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']) {
      const roll = random();
      const status = roll < 0.78 * progressFactor ? 'done' : roll < 0.9 ? 'late' : 'missed';
      if (status !== 'missed') prayersDone += 1;
      prayerLogs.push({ userId: user.id, date, name, status });
    }

    // Poids : tendance a la baisse avec des fluctuations quotidiennes.
    weight += -0.045 + (random() - 0.5) * 0.35;
    weight = Math.round(weight * 10) / 10;
    if (offset % 2 === 0) {
      weights.push({ userId: user.id, date, weightKg: weight });
    }

    // Repas
    const calories = Math.round(1750 + random() * 700);
    const protein = Math.round(95 + random() * 60);
    meals.push(
      { userId: user.id, date, type: 'breakfast', name: 'Flocons d\'avoine et fruits', calories: Math.round(calories * 0.25), protein: Math.round(protein * 0.2), carbs: 55, fat: 12, fiber: 8, quantity: 1, unit: 'portion' },
      { userId: user.id, date, type: 'lunch', name: 'Poulet, riz et legumes', calories: Math.round(calories * 0.4), protein: Math.round(protein * 0.45), carbs: 75, fat: 18, fiber: 9, quantity: 1, unit: 'portion' },
      { userId: user.id, date, type: 'dinner', name: 'Saumon et patate douce', calories: Math.round(calories * 0.35), protein: Math.round(protein * 0.35), carbs: 45, fat: 22, fiber: 7, quantity: 1, unit: 'portion' },
    );

    const waterMl = Math.round((1400 + random() * 1200) / 250) * 250;
    waterLogs.push({ userId: user.id, date, amountMl: waterMl });

    // Sport, environ un jour sur deux
    let workoutMinutes = 0;
    if (random() < 0.5 * progressFactor) {
      workoutMinutes = Math.round(35 + random() * 45);
      const types = ['strength', 'cardio', 'run', 'walk'];
      workouts.push({
        userId: user.id,
        date,
        name: ['Haut du corps', 'Bas du corps', 'Course en exterieur', 'Full body'][Math.floor(random() * 4)],
        type: types[Math.floor(random() * types.length)],
        durationMin: workoutMinutes,
        calories: Math.round(workoutMinutes * (6 + random() * 4)),
        intensity: random() < 0.4 ? 'high' : 'medium',
      });
    }

    // Concentration
    const focusMinutes = Math.round(45 + random() * 150 * progressFactor);
    focusSessions.push({ userId: user.id, date, minutes: focusMinutes, label: 'Travail profond' });
    const readingMinutes = random() < 0.6 ? Math.round(20 + random() * 40) : 0;
    if (readingMinutes > 0) {
      focusSessions.push({ userId: user.id, date, minutes: readingMinutes, label: 'Lecture' });
    }

    // Journal, environ un jour sur trois
    const mood = Math.max(1, Math.min(5, Math.round(3 + (random() - 0.4) * 2.5)));
    if (random() < 0.35) {
      journalEntries.push({
        userId: user.id,
        date,
        mood,
        energy: Math.max(1, Math.min(5, mood + (random() < 0.5 ? -1 : 1))),
        title: 'Journee de travail',
        content:
          'Journee dense. J\'ai tenu mes habitudes principales et avance sur le projet. Le sommeil reste le point faible : je dois couper les ecrans plus tot.',
        gratitude: 'Ma sante, ma famille, le temps que j\'ai pu degager pour lire.',
        tags: JSON.stringify(['travail', 'discipline']),
        media: JSON.stringify([]),
      });
    }

    // Instantane statistique
    const habitsTotal = habits.length;
    const tasksTotal = Math.round(2 + random() * 4);
    const tasksDone = Math.round(tasksTotal * (0.5 + random() * 0.5 * progressFactor));
    const completionRate = Math.round(((habitsDone + tasksDone) / (habitsTotal + tasksTotal)) * 100);
    const disciplineScore = Math.min(
      100,
      Math.round(
        (habitsDone / habitsTotal) * 40 +
          (tasksDone / Math.max(1, tasksTotal)) * 25 +
          (prayersDone / 5) * 15 +
          Math.min(1, workoutMinutes / 30) * 10 +
          Math.min(1, focusMinutes / 120) * 10,
      ),
    );

    dailyStats.push({
      userId: user.id,
      date,
      habitsDone,
      habitsTotal,
      tasksDone,
      tasksTotal,
      prayersDone,
      calories,
      proteinG: protein,
      waterMl,
      weightKg: weight,
      workoutMinutes,
      focusMinutes: focusMinutes + readingMinutes,
      readingMinutes,
      mood,
      xpEarned: habitsDone * 15 + tasksDone * 5 + (workoutMinutes > 0 ? 25 : 0),
      disciplineScore,
      completionRate,
    });
  }

  await prisma.habitLog.createMany({ data: habitLogs });
  await prisma.prayerLog.createMany({ data: prayerLogs });
  await prisma.weightEntry.createMany({ data: weights });
  await prisma.meal.createMany({ data: meals });
  await prisma.waterLog.createMany({ data: waterLogs });
  await prisma.workout.createMany({ data: workouts });
  await prisma.focusSession.createMany({ data: focusSessions });
  await prisma.journalEntry.createMany({ data: journalEntries });
  await prisma.dailyStat.createMany({ data: dailyStats });

  console.log(`  ${DAYS} jours d'historique generes`);

  // --- Objectifs ---
  const goals = [
    {
      title: 'Perdre 10 kg',
      description: 'Atteindre 78 kg en gardant ma masse musculaire.',
      category: 'health',
      horizon: 'mid',
      priority: 'high',
      color: '#f6d9e4',
      targetValue: 78,
      currentValue: weight,
      unit: 'kg',
      deadline: new Date(Date.now() + 120 * 86_400_000),
      steps: ['Deficit calorique de 400 kcal', '4 seances de sport par semaine', '10 000 pas quotidiens', 'Peser 3 fois par semaine'],
    },
    {
      title: 'Lire 24 livres cette annee',
      description: 'Deux livres par mois, principalement essais et biographies.',
      category: 'learning',
      horizon: 'long',
      priority: 'medium',
      color: '#d9c7f0',
      targetValue: 24,
      currentValue: 9,
      unit: 'livres',
      deadline: new Date(new Date().getFullYear(), 11, 31),
      steps: ['30 minutes de lecture chaque matin', 'Une fiche de lecture par livre', 'Supprimer les reseaux avant 20 h'],
    },
    {
      title: 'Lancer mon activite',
      description: 'Passer du projet a la premiere vente.',
      category: 'career',
      horizon: 'long',
      priority: 'urgent',
      color: '#fbc7da',
      deadline: new Date(Date.now() + 180 * 86_400_000),
      steps: ['Valider le probleme aupres de 20 personnes', 'Construire la version minimale', 'Trouver les 10 premiers clients', 'Mettre en place la facturation'],
    },
  ];

  for (const goal of goals) {
    const { steps, ...fields } = goal;
    await prisma.goal.create({
      data: {
        userId: user.id,
        ...fields,
        progress: Math.round(random() * 60) + 10,
        steps: {
          create: steps.map((title, index) => ({
            userId: user.id,
            title,
            position: index,
            done: index < Math.floor(steps.length / 2),
          })),
        },
      },
    });
  }

  // --- Taches ---
  const tasks = [
    { title: 'Preparer les repas de la semaine', priority: 'high', offset: 0 },
    { title: 'Seance jambes a la salle', priority: 'medium', offset: 0 },
    { title: 'Appeler le comptable', priority: 'urgent', offset: 1 },
    { title: 'Terminer le chapitre 7', priority: 'medium', offset: 1 },
    { title: 'Revoir le budget du mois', priority: 'high', offset: 3 },
    { title: 'Ecrire la page de vente', priority: 'urgent', offset: 4 },
    { title: 'Prendre rendez-vous chez le dentiste', priority: 'low', offset: 7 },
  ];

  for (const [index, task] of tasks.entries()) {
    await prisma.task.create({
      data: {
        userId: user.id,
        title: task.title,
        priority: task.priority,
        status: index < 2 ? 'done' : 'todo',
        completedAt: index < 2 ? new Date() : null,
        dueDate: new Date(Date.now() + task.offset * 86_400_000),
        tags: JSON.stringify([]),
        position: index,
      },
    });
  }

  // --- Finances ---
  const transactions = [
    { type: 'income', category: 'salary', label: 'Salaire', amount: 2850, day: 1 },
    { type: 'expense', category: 'housing', label: 'Loyer', amount: 950, day: 3, recurring: true },
    { type: 'expense', category: 'food', label: 'Courses', amount: 320, day: 5 },
    { type: 'expense', category: 'transport', label: 'Abonnement transport', amount: 84, day: 5, recurring: true },
    { type: 'expense', category: 'subscriptions', label: 'Abonnements numeriques', amount: 45, day: 8, recurring: true },
    { type: 'expense', category: 'health', label: 'Salle de sport', amount: 39, day: 10, recurring: true },
    { type: 'expense', category: 'leisure', label: 'Restaurant', amount: 68, day: 14 },
    { type: 'expense', category: 'savings', label: 'Epargne mensuelle', amount: 400, day: 15, recurring: true },
  ];

  const month = new Date().toISOString().slice(0, 7);
  for (const transaction of transactions) {
    await prisma.transaction.create({
      data: {
        userId: user.id,
        date: `${month}-${String(transaction.day).padStart(2, '0')}`,
        type: transaction.type,
        category: transaction.category,
        label: transaction.label,
        amount: transaction.amount,
        currency: 'EUR',
        recurring: transaction.recurring ?? false,
      },
    });
  }

  // --- Notes ---
  await prisma.note.createMany({
    data: [
      {
        userId: user.id,
        title: 'Principes de discipline',
        content:
          '1. Ne jamais manquer deux jours de suite.\n2. Rendre la bonne action facile et la mauvaise difficile.\n3. Mesurer ce qui compte.\n4. Le systeme bat la motivation.',
        pinned: true,
        color: '#fbc7da',
        tags: JSON.stringify(['discipline']),
      },
      {
        userId: user.id,
        title: 'Idees de contenu',
        content: '- Mon systeme de suivi d\'habitudes\n- Comment je planifie ma semaine\n- Retour sur 90 jours de discipline',
        color: '#d9c7f0',
        tags: JSON.stringify(['business']),
      },
    ],
  });

  // --- XP et badges ---
  const totalXp = dailyStats.reduce((sum, day) => sum + day.xpEarned, 0);
  await prisma.user.update({
    where: { id: user.id },
    data: { xp: totalXp, level: Math.max(1, Math.floor(Math.sqrt(totalXp / 50))) },
  });

  for (const code of ['first_step', 'week_streak', 'month_streak', 'scribe', 'level_10']) {
    const badge = await prisma.badge.findUnique({ where: { code } });
    if (badge) {
      await prisma.userBadge.create({ data: { userId: user.id, badgeId: badge.id } }).catch(() => undefined);
    }
  }

  console.log(`  ${totalXp} XP attribues, 5 badges debloques`);
  console.log('\nSeed termine. Connectez-vous avec demo@lifeofm.app / Demo1234\n');
}

main()
  .catch((error) => {
    console.error('Echec du seed :', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
