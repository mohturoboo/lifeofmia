import { prisma } from '@/lib/prisma';
import { stringifyJson } from '@/lib/json';
import { dateKeyIn } from '@/lib/date';
import { recomputeDay } from '@/lib/stats';
import type { SessionUser } from '@/lib/auth/session';
import {
  habitCreateSchema,
  taskCreateSchema,
  goalCreateSchema,
  mealCreateSchema,
  workoutCreateSchema,
} from '@/lib/validation/modules';

/**
 * Outils de l'agent Life AI.
 *
 * Deux garde-fous structurent ce module :
 *
 *  1. **Isolation** — chaque executeur recoit l'utilisateur de la session et
 *     ecrit `userId` lui-meme. Le modele ne peut pas fournir d'identifiant
 *     d'utilisateur, et toute lecture ou suppression verifie l'appartenance.
 *
 *  2. **Meme validation que l'interface** — les entrees passent par les schemas
 *     Zod deja utilises par l'API REST. L'agent ne peut donc rien ecrire qu'un
 *     humain ne pourrait pas saisir a la main.
 */

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolResult {
  ok: boolean;
  summary: string;
  data?: unknown;
}

type Executor = (user: SessionUser, input: Record<string, unknown>) => Promise<ToolResult>;

const str = (description: string, extra: Record<string, unknown> = {}) => ({
  type: 'string',
  description,
  ...extra,
});
const num = (description: string, extra: Record<string, unknown> = {}) => ({
  type: 'number',
  description,
  ...extra,
});

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'create_habit',
    description:
      "Cree une nouvelle habitude quotidienne pour l'utilisateur. A utiliser pour installer un rituel concret et repetable.",
    input_schema: {
      type: 'object',
      properties: {
        name: str('Nom court et actionnable, ex. "Lire 20 minutes"'),
        category: str('Categorie', { enum: ['health', 'spirituality', 'mind', 'work', 'sport', 'social', 'other'] }),
        icon: str('Icone parmi : check, flame, book, dumbbell, moon, droplet, apple, target, clock, zap, sparkles, shield'),
        color: str('Couleur hexadecimale, ex. #e9b8d5'),
        targetPerDay: num('Nombre de repetitions par jour (defaut 1)'),
        unit: str('Unite de mesure si pertinent, ex. "verres", "pages"'),
        reminderAt: str('Heure de rappel au format HH:mm'),
        isNegative: { type: 'boolean', description: 'true si le but est de NE PAS faire cette action' },
        xpReward: num('XP accordee par validation, entre 5 et 30'),
      },
      required: ['name', 'category'],
    },
  },
  {
    name: 'delete_habit',
    description: "Supprime definitivement une habitude et son historique. Demander confirmation a l'utilisateur avant usage.",
    input_schema: {
      type: 'object',
      properties: { habitId: str("Identifiant de l'habitude, issu du contexte") },
      required: ['habitId'],
    },
  },
  {
    name: 'create_task',
    description: 'Cree une tache. Utiliser pour toute action ponctuelle, par opposition a une habitude repetee.',
    input_schema: {
      type: 'object',
      properties: {
        title: str('Intitule de la tache'),
        description: str('Details complementaires'),
        priority: str('Priorite', { enum: ['low', 'medium', 'high', 'urgent'] }),
        dueDate: str('Echeance au format YYYY-MM-DD'),
        estimateMin: num('Duree estimee en minutes'),
        goalId: str("Identifiant de l'objectif auquel rattacher la tache"),
      },
      required: ['title'],
    },
  },
  {
    name: 'create_goal',
    description:
      "Cree un objectif structure avec ses etapes. C'est l'outil a privilegier quand l'utilisateur exprime une ambition (perdre du poids, apprendre une langue, lancer un projet).",
    input_schema: {
      type: 'object',
      properties: {
        title: str("Intitule de l'objectif"),
        description: str('Contexte et motivation'),
        category: str('Categorie', { enum: ['health', 'career', 'finance', 'spiritual', 'learning', 'personal'] }),
        horizon: str('Horizon temporel', { enum: ['short', 'mid', 'long'] }),
        deadline: str('Date limite au format YYYY-MM-DD'),
        targetValue: num('Valeur cible mesurable, ex. 75 pour 75 kg'),
        currentValue: num('Valeur actuelle'),
        unit: str('Unite de la valeur, ex. "kg", "pages", "€"'),
        steps: {
          type: 'array',
          items: { type: 'string' },
          description: 'Etapes concretes et ordonnees (3 a 8 recommandees)',
        },
      },
      required: ['title', 'category', 'horizon'],
    },
  },
  {
    name: 'update_goal_progress',
    description: "Met a jour la valeur courante ou le statut d'un objectif existant.",
    input_schema: {
      type: 'object',
      properties: {
        goalId: str("Identifiant de l'objectif"),
        currentValue: num('Nouvelle valeur courante'),
        status: str('Nouveau statut', { enum: ['active', 'paused', 'done', 'abandoned'] }),
      },
      required: ['goalId'],
    },
  },
  {
    name: 'create_meal',
    description: "Enregistre un repas dans le suivi alimentaire, ou propose un modele de repas reutilisable.",
    input_schema: {
      type: 'object',
      properties: {
        name: str('Nom du repas'),
        type: str('Moment du repas', { enum: ['breakfast', 'lunch', 'dinner', 'snack'] }),
        date: str('Date au format YYYY-MM-DD (defaut : aujourd\'hui)'),
        calories: num('Calories'),
        protein: num('Proteines en grammes'),
        carbs: num('Glucides en grammes'),
        fat: num('Lipides en grammes'),
        fiber: num('Fibres en grammes'),
        isTemplate: { type: 'boolean', description: 'true pour un modele reutilisable non comptabilise ce jour' },
        notes: str('Composition ou preparation'),
      },
      required: ['name', 'type', 'calories'],
    },
  },
  {
    name: 'create_workout',
    description: 'Cree une seance de sport, avec ses exercices detailles si pertinent.',
    input_schema: {
      type: 'object',
      properties: {
        name: str('Nom de la seance, ex. "Haut du corps"'),
        type: str('Type de seance', { enum: ['strength', 'cardio', 'walk', 'run', 'swim', 'yoga', 'other'] }),
        date: str('Date au format YYYY-MM-DD (defaut : aujourd\'hui)'),
        durationMin: num('Duree en minutes'),
        intensity: str('Intensite', { enum: ['low', 'medium', 'high'] }),
        notes: str('Consignes ou ressenti'),
        exercises: {
          type: 'array',
          description: 'Liste des exercices',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              sets: { type: 'number' },
              reps: { type: 'number' },
              weightKg: { type: 'number' },
              restSec: { type: 'number' },
            },
            required: ['name'],
          },
        },
      },
      required: ['name', 'type', 'durationMin'],
    },
  },
  {
    name: 'plan_day',
    description:
      "Construit le planning d'une journee : cree en une fois plusieurs taches horodatees. Utiliser quand l'utilisateur demande d'organiser sa journee.",
    input_schema: {
      type: 'object',
      properties: {
        date: str('Date au format YYYY-MM-DD'),
        blocks: {
          type: 'array',
          description: 'Blocs de la journee, dans l\'ordre chronologique',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              startTime: { type: 'string', description: 'Heure de debut au format HH:mm' },
              durationMin: { type: 'number' },
              priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
            },
            required: ['title', 'startTime'],
          },
        },
      },
      required: ['date', 'blocks'],
    },
  },
  {
    name: 'get_statistics',
    description:
      "Recupere les statistiques detaillees de l'utilisateur sur une periode donnee, au-dela du resume deja fourni dans le contexte.",
    input_schema: {
      type: 'object',
      properties: {
        days: num('Nombre de jours a analyser (7, 30, 90, 180 ou 365)'),
      },
      required: ['days'],
    },
  },
];

/** Convertit une valeur inconnue en nombre sur, avec repli. */
const toNumber = (value: unknown, fallback: number): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const EXECUTORS: Record<string, Executor> = {
  async create_habit(user, input) {
    const parsed = habitCreateSchema.parse({
      name: String(input.name ?? '').slice(0, 80),
      category: input.category ?? 'other',
      icon: input.icon ?? 'check',
      color: typeof input.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(input.color) ? input.color : '#e9b8d5',
      targetPerDay: toNumber(input.targetPerDay, 1),
      unit: input.unit ?? null,
      reminderAt: typeof input.reminderAt === 'string' && /^\d{2}:\d{2}$/.test(input.reminderAt) ? input.reminderAt : null,
      isNegative: Boolean(input.isNegative),
      xpReward: Math.min(30, Math.max(5, toNumber(input.xpReward, 10))),
    });

    const last = await prisma.habit.findFirst({
      where: { userId: user.id },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const habit = await prisma.habit.create({
      data: {
        userId: user.id,
        name: parsed.name,
        description: parsed.description,
        icon: parsed.icon,
        color: parsed.color,
        category: parsed.category,
        frequency: parsed.frequency,
        weekDays: stringifyJson(parsed.weekDays),
        targetPerDay: parsed.targetPerDay,
        unit: parsed.unit,
        importance: parsed.importance,
        xpReward: parsed.xpReward,
        reminderAt: parsed.reminderAt ?? null,
        isNegative: parsed.isNegative,
        position: (last?.position ?? -1) + 1,
      },
    });

    return { ok: true, summary: `Habitude creee : « ${habit.name} »`, data: { id: habit.id, name: habit.name } };
  },

  async delete_habit(user, input) {
    const habit = await prisma.habit.findFirst({
      where: { id: String(input.habitId), userId: user.id },
      select: { id: true, name: true },
    });
    if (!habit) return { ok: false, summary: 'Habitude introuvable.' };

    await prisma.habit.delete({ where: { id: habit.id } });
    return { ok: true, summary: `Habitude supprimee : « ${habit.name} »` };
  },

  async create_task(user, input) {
    const dueDate =
      typeof input.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)
        ? new Date(`${input.dueDate}T12:00:00`)
        : null;

    // Un objectif fourni par le modele doit appartenir a l'utilisateur.
    let goalId: string | null = null;
    if (typeof input.goalId === 'string') {
      const goal = await prisma.goal.findFirst({
        where: { id: input.goalId, userId: user.id },
        select: { id: true },
      });
      goalId = goal?.id ?? null;
    }

    const parsed = taskCreateSchema.parse({
      title: String(input.title ?? '').slice(0, 160),
      description: input.description ?? null,
      priority: input.priority ?? 'medium',
      estimateMin: input.estimateMin !== undefined ? toNumber(input.estimateMin, 0) : null,
      dueDate,
      goalId,
    });

    const task = await prisma.task.create({
      data: {
        userId: user.id,
        title: parsed.title,
        description: parsed.description,
        priority: parsed.priority,
        status: 'todo',
        dueDate: parsed.dueDate,
        estimateMin: parsed.estimateMin ?? null,
        goalId: parsed.goalId ?? null,
        tags: stringifyJson([]),
      },
    });

    return { ok: true, summary: `Tache creee : « ${task.title} »`, data: { id: task.id } };
  },

  async create_goal(user, input) {
    const steps = Array.isArray(input.steps)
      ? input.steps.filter((step): step is string => typeof step === 'string').slice(0, 12)
      : [];

    const parsed = goalCreateSchema.parse({
      title: String(input.title ?? '').slice(0, 160),
      description: input.description ?? null,
      category: input.category ?? 'personal',
      horizon: input.horizon ?? 'short',
      targetValue: input.targetValue !== undefined ? toNumber(input.targetValue, 0) : null,
      currentValue: input.currentValue !== undefined ? toNumber(input.currentValue, 0) : null,
      unit: input.unit ?? null,
      deadline:
        typeof input.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.deadline)
          ? new Date(`${input.deadline}T12:00:00`)
          : null,
      steps,
    });

    const goal = await prisma.goal.create({
      data: {
        userId: user.id,
        title: parsed.title,
        description: parsed.description,
        category: parsed.category,
        horizon: parsed.horizon,
        priority: parsed.priority,
        targetValue: parsed.targetValue ?? null,
        currentValue: parsed.currentValue ?? null,
        unit: parsed.unit,
        deadline: parsed.deadline,
        color: parsed.color,
        steps: { create: parsed.steps.map((title, index) => ({ userId: user.id, title, position: index })) },
      },
      include: { steps: true },
    });

    return {
      ok: true,
      summary: `Objectif cree : « ${goal.title} » (${goal.steps.length} etapes)`,
      data: { id: goal.id },
    };
  },

  async update_goal_progress(user, input) {
    const goal = await prisma.goal.findFirst({
      where: { id: String(input.goalId), userId: user.id },
      select: { id: true, title: true, targetValue: true },
    });
    if (!goal) return { ok: false, summary: 'Objectif introuvable.' };

    const data: Record<string, unknown> = {};
    if (input.currentValue !== undefined) data.currentValue = toNumber(input.currentValue, 0);
    if (typeof input.status === 'string' && ['active', 'paused', 'done', 'abandoned'].includes(input.status)) {
      data.status = input.status;
      if (input.status === 'done') {
        data.completedAt = new Date();
        data.progress = 100;
      }
    }

    await prisma.goal.update({ where: { id: goal.id }, data });
    return { ok: true, summary: `Objectif mis a jour : « ${goal.title} »` };
  },

  async create_meal(user, input) {
    const date =
      typeof input.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.date)
        ? input.date
        : dateKeyIn(user.timezone);

    const parsed = mealCreateSchema.parse({
      date,
      type: input.type ?? 'lunch',
      name: String(input.name ?? '').slice(0, 120),
      calories: toNumber(input.calories, 0),
      protein: toNumber(input.protein, 0),
      carbs: toNumber(input.carbs, 0),
      fat: toNumber(input.fat, 0),
      fiber: toNumber(input.fiber, 0),
      isTemplate: Boolean(input.isTemplate),
      notes: input.notes ?? null,
    });

    const meal = await prisma.meal.create({
      data: { userId: user.id, ...parsed, aiGenerated: true },
    });
    if (!parsed.isTemplate) await recomputeDay(user.id, date);

    return {
      ok: true,
      summary: `Repas ${parsed.isTemplate ? 'propose' : 'enregistre'} : « ${meal.name} » (${Math.round(meal.calories)} kcal)`,
      data: { id: meal.id },
    };
  },

  async create_workout(user, input) {
    const date =
      typeof input.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.date)
        ? input.date
        : dateKeyIn(user.timezone);

    const exercises = Array.isArray(input.exercises)
      ? input.exercises.slice(0, 30).map((raw) => {
          const exercise = raw as Record<string, unknown>;
          return {
            name: String(exercise.name ?? 'Exercice').slice(0, 80),
            sets: Math.max(0, Math.round(toNumber(exercise.sets, 0))),
            reps: Math.max(0, Math.round(toNumber(exercise.reps, 0))),
            weightKg: exercise.weightKg !== undefined ? toNumber(exercise.weightKg, 0) : null,
            restSec: exercise.restSec !== undefined ? Math.round(toNumber(exercise.restSec, 0)) : null,
          };
        })
      : [];

    const parsed = workoutCreateSchema.parse({
      date,
      name: String(input.name ?? '').slice(0, 120),
      type: input.type ?? 'strength',
      durationMin: Math.round(toNumber(input.durationMin, 30)),
      intensity: input.intensity ?? 'medium',
      notes: input.notes ?? null,
      exercises,
    });

    const workout = await prisma.workout.create({
      data: {
        userId: user.id,
        date: parsed.date,
        name: parsed.name,
        type: parsed.type,
        durationMin: parsed.durationMin,
        intensity: parsed.intensity,
        notes: parsed.notes,
        aiGenerated: true,
        exercises: {
          create: parsed.exercises.map((exercise, index) => ({
            name: exercise.name,
            sets: exercise.sets,
            reps: exercise.reps,
            weightKg: exercise.weightKg ?? null,
            restSec: exercise.restSec ?? null,
            position: index,
          })),
        },
      },
      include: { exercises: true },
    });

    await recomputeDay(user.id, parsed.date);
    return {
      ok: true,
      summary: `Seance creee : « ${workout.name} » (${workout.exercises.length} exercices, ${workout.durationMin} min)`,
      data: { id: workout.id },
    };
  },

  async plan_day(user, input) {
    const date =
      typeof input.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.date)
        ? input.date
        : dateKeyIn(user.timezone);

    const blocks = Array.isArray(input.blocks) ? input.blocks.slice(0, 15) : [];
    if (blocks.length === 0) return { ok: false, summary: 'Aucun bloc fourni.' };

    const created: string[] = [];
    for (const raw of blocks) {
      const block = raw as Record<string, unknown>;
      const startTime = typeof block.startTime === 'string' && /^\d{2}:\d{2}$/.test(block.startTime)
        ? block.startTime
        : '09:00';
      const title = String(block.title ?? 'Bloc').slice(0, 160);

      const task = await prisma.task.create({
        data: {
          userId: user.id,
          title: `${startTime} — ${title}`,
          priority: (['low', 'medium', 'high', 'urgent'] as const).includes(block.priority as never)
            ? String(block.priority)
            : 'medium',
          status: 'todo',
          dueDate: new Date(`${date}T${startTime}:00`),
          estimateMin: block.durationMin !== undefined ? Math.round(toNumber(block.durationMin, 30)) : null,
          tags: stringifyJson(['planning']),
        },
      });
      created.push(task.title);
    }

    return {
      ok: true,
      summary: `Journee du ${date} planifiee : ${created.length} blocs crees`,
      data: { blocks: created },
    };
  },

  async get_statistics(user, input) {
    const days = [7, 30, 90, 180, 365].includes(Number(input.days)) ? Number(input.days) : 30;
    const { lastNDays, dateKeyIn: dayKey } = await import('@/lib/date');
    const { readRange, aggregate } = await import('@/lib/stats');

    const series = await readRange(user.id, lastNDays(days, dayKey(user.timezone)));
    const totals = aggregate(series);

    return {
      ok: true,
      summary: `Statistiques sur ${days} jours recuperees`,
      data: totals,
    };
  },
};

/** Execute un outil demande par le modele. Ne jette jamais : renvoie l'echec. */
export async function executeTool(
  user: SessionUser,
  name: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  const executor = EXECUTORS[name];
  if (!executor) return { ok: false, summary: `Outil inconnu : ${name}` };

  try {
    return await executor(user, input);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erreur inconnue';
    return { ok: false, summary: `Echec de l'outil ${name} : ${message}` };
  }
}
