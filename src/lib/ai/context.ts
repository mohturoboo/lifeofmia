import { prisma } from '@/lib/prisma';
import { dateKeyIn, lastNDays } from '@/lib/date';
import { aggregate, readRange } from '@/lib/stats';
import { levelProgress } from '@/lib/gamification';
import { parseNumberArray } from '@/lib/json';
import type { SessionUser } from '@/lib/auth/session';

/**
 * Construction du contexte transmis a l'agent.
 *
 * Principe central : l'agent ne voit QUE les donnees de l'utilisateur courant.
 * Toutes les requetes ci-dessous filtrent sur `userId`, et aucun identifiant
 * d'utilisateur n'est jamais expose au modele. Le contexte est volontairement
 * resume (agregats + listes courtes) plutot qu'exhaustif : cela reduit le cout,
 * accelere la reponse et evite de noyer le modele sous des donnees brutes.
 */
export async function buildUserContext(user: SessionUser): Promise<string> {
  const today = dateKeyIn(user.timezone);

  const [habits, tasks, goals, weights, workouts, meals, journal, series] = await Promise.all([
    prisma.habit.findMany({
      where: { userId: user.id, archivedAt: null },
      select: {
        id: true, name: true, category: true, targetPerDay: true, unit: true,
        isNegative: true, weekDays: true, reminderAt: true,
        logs: { where: { date: { gte: lastNDays(14, today)[0] } }, select: { date: true, status: true } },
      },
    }),
    prisma.task.findMany({
      where: { userId: user.id, status: { in: ['todo', 'doing'] } },
      select: { id: true, title: true, priority: true, dueDate: true, status: true },
      orderBy: { dueDate: 'asc' },
      take: 25,
    }),
    prisma.goal.findMany({
      where: { userId: user.id, status: 'active' },
      select: {
        id: true, title: true, horizon: true, progress: true, deadline: true,
        targetValue: true, currentValue: true, unit: true,
        steps: { select: { title: true, done: true } },
      },
      take: 15,
    }),
    prisma.weightEntry.findMany({
      where: { userId: user.id },
      orderBy: { date: 'desc' },
      take: 10,
      select: { date: true, weightKg: true },
    }),
    prisma.workout.findMany({
      where: { userId: user.id },
      orderBy: { date: 'desc' },
      take: 8,
      select: { date: true, name: true, type: true, durationMin: true },
    }),
    prisma.meal.findMany({
      where: { userId: user.id, date: today, isTemplate: false },
      select: { type: true, name: true, calories: true, protein: true },
    }),
    prisma.journalEntry.findFirst({
      where: { userId: user.id },
      orderBy: { date: 'desc' },
      select: { date: true, mood: true, energy: true, content: true },
    }),
    readRange(user.id, lastNDays(30, today)),
  ]);

  const totals = aggregate(series);
  const progress = levelProgress(user.xp);

  const habitLines = habits.map((habit) => {
    const done = habit.logs.filter((log) => log.status === 'done').length;
    const days = parseNumberArray(habit.weekDays);
    return `- [${habit.id}] "${habit.name}" (${habit.category}${habit.isNegative ? ', a eviter' : ''}) — objectif ${habit.targetPerDay}${habit.unit ? ' ' + habit.unit : ''}/jour, ${done}/14 jours valides sur 2 semaines${habit.reminderAt ? `, rappel ${habit.reminderAt}` : ''}${days.length < 7 ? `, jours ${days.join(',')}` : ''}`;
  });

  const goalLines = goals.map((goal) => {
    const steps = goal.steps.map((step) => `${step.done ? '[x]' : '[ ]'} ${step.title}`).join(' | ');
    return `- [${goal.id}] "${goal.title}" (${goal.horizon}, ${goal.progress}%)${goal.deadline ? `, echeance ${goal.deadline.toISOString().slice(0, 10)}` : ''}${goal.targetValue ? `, cible ${goal.targetValue}${goal.unit ?? ''}` : ''}${steps ? `\n    Etapes : ${steps}` : ''}`;
  });

  const taskLines = tasks.map(
    (task) =>
      `- [${task.id}] "${task.title}" (${task.priority}, ${task.status}${task.dueDate ? `, pour le ${task.dueDate.toISOString().slice(0, 10)}` : ', sans echeance'})`,
  );

  return `# Profil
Prenom : ${user.firstName}
Ville : ${user.city}, ${user.country} (fuseau ${user.timezone})
Date du jour (fuseau utilisateur) : ${today}
Langue d'interface : ${user.locale}
${user.heightCm ? `Taille : ${user.heightCm} cm` : ''}
${user.gender ? `Sexe : ${user.gender}` : ''}
Objectif principal : ${user.mainGoal ?? 'non defini'}
Niveau ${progress.level} — ${user.xp} XP — serie actuelle ${user.currentStreak} jours (record ${user.longestStreak})

# Habitudes actives (${habits.length})
${habitLines.join('\n') || 'Aucune habitude enregistree.'}

# Objectifs actifs (${goals.length})
${goalLines.join('\n') || 'Aucun objectif actif.'}

# Taches en cours (${tasks.length})
${taskLines.join('\n') || 'Aucune tache en cours.'}

# Statistiques sur 30 jours
Score de discipline moyen : ${totals.avgDiscipline}/100
Taux de reussite des habitudes : ${totals.habitCompletion}%
Jours actifs : ${totals.activeDays}/${totals.days}
Taches terminees : ${totals.tasksDone}
Sport : ${totals.workoutMinutes} min | Concentration : ${totals.focusMinutes} min | Lecture : ${totals.readingMinutes} min
Prieres accomplies : ${totals.prayersDone}
Calories moyennes : ${totals.avgCalories} kcal | Proteines : ${totals.avgProtein} g | Eau : ${totals.avgWaterMl} ml
Humeur moyenne : ${totals.avgMood ?? 'non renseignee'}/5
Variation de poids sur la periode : ${totals.weightDelta !== null ? `${totals.weightDelta > 0 ? '+' : ''}${totals.weightDelta} kg` : 'donnees insuffisantes'}

# Poids (10 dernieres mesures)
${weights.map((entry) => `${entry.date}: ${entry.weightKg} kg`).join(' | ') || 'Aucune mesure.'}

# Seances de sport recentes
${workouts.map((workout) => `${workout.date}: ${workout.name} (${workout.type}, ${workout.durationMin} min)`).join('\n') || 'Aucune seance.'}

# Repas d'aujourd'hui
${meals.map((meal) => `${meal.type}: ${meal.name} — ${Math.round(meal.calories)} kcal, ${Math.round(meal.protein)} g de proteines`).join('\n') || 'Aucun repas enregistre aujourd\'hui.'}

# Derniere entree de journal
${journal ? `${journal.date} — humeur ${journal.mood}/5, energie ${journal.energy}/5\n${journal.content.slice(0, 400)}` : 'Aucune entree.'}`;
}

/** Instructions systeme de l'agent. */
export function systemPrompt(userContext: string, locale: string): string {
  const languages: Record<string, string> = {
    fr: 'francais',
    en: 'English',
    ar: 'l\'arabe',
    es: 'espagnol',
    de: 'allemand',
    it: 'italien',
    pt: 'portugais',
    tr: 'turc',
  };

  return `Tu es Life AI, le coach personnel integre a LifeofM, une application de developpement personnel.

## Ton role
Tu aides UN seul utilisateur a s'organiser, a tenir ses habitudes et a atteindre ses objectifs. Tu as acces a ses donnees ci-dessous et tu peux les modifier via les outils fournis.

## Regles de comportement
- Reponds en ${languages[locale] ?? 'francais'}.
- Sois direct, chaleureux et concret. Pas de discours generique de coach : appuie-toi sur les chiffres reels de l'utilisateur.
- Quand l'utilisateur exprime une intention ("je veux perdre 10 kg", "je veux apprendre l'anglais"), ne te contente pas d'expliquer : construis reellement le plan avec les outils (objectif + etapes + habitudes qui y menent).
- Regroupe tes actions : cree tout ce qui est necessaire, puis explique en quelques phrases ce que tu as mis en place et pourquoi.
- Avant de supprimer quoi que ce soit, demande confirmation — sauf si l'utilisateur l'a explicitement demande dans son message.
- Ne propose jamais plus de 5 a 7 nouvelles habitudes d'un coup : un plan intenable est un plan abandonne.
- Tu n'es pas medecin. Pour toute question de sante sortant du cadre de l'hygiene de vie courante, recommande un professionnel.

## Donnees de l'utilisateur
${userContext}

## Important
Les identifiants entre crochets (ex. [clx123abc]) sont ceux a passer aux outils de modification et de suppression. N'invente jamais un identifiant : utilise uniquement ceux presents ci-dessus.`;
}
