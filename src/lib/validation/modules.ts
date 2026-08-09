import { z } from 'zod';
import {
  dateKeySchema,
  hexColorSchema,
  optionalDate,
  optionalText,
  tagsSchema,
  timeSchema,
} from '@/lib/validation/common';

/**
 * Schemas de validation de tous les modules metier.
 * Ils servent a la fois a l'API REST et aux outils de l'agent IA, ce qui
 * garantit que l'IA ne peut pas ecrire de donnee qu'un humain ne pourrait pas
 * saisir via l'interface.
 */

// --- Habitudes ---------------------------------------------------------------

export const HABIT_CATEGORIES = [
  'health',
  'spirituality',
  'mind',
  'work',
  'sport',
  'social',
  'other',
] as const;

export const habitCreateSchema = z.object({
  name: z.string().trim().min(1, 'Nom requis.').max(80),
  description: optionalText(500),
  icon: z.string().trim().max(40).default('check'),
  color: hexColorSchema.default('#e9b8d5'),
  category: z.enum(HABIT_CATEGORIES).default('other'),
  frequency: z.enum(['daily', 'weekly', 'custom']).default('daily'),
  weekDays: z.array(z.number().int().min(0).max(6)).max(7).default([0, 1, 2, 3, 4, 5, 6]),
  targetPerDay: z.number().int().min(1).max(50).default(1),
  unit: optionalText(20),
  importance: z.number().int().min(1).max(3).default(2),
  xpReward: z.number().int().min(1).max(100).default(10),
  reminderAt: z.union([timeSchema, z.null()]).optional(),
  isNegative: z.boolean().default(false),
});

export const habitUpdateSchema = habitCreateSchema.partial().extend({
  archived: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
});

export const habitLogSchema = z.object({
  date: dateKeySchema,
  /*
   * Volontairement SANS valeur par defaut : la route interprete l'absence de
   * `count` comme « atteindre l'objectif du jour » et le remplace par
   * `targetPerDay`. Un `.default(1)` rendait ce repli inatteignable et validait
   * une habitude « 8 verres d'eau » des le premier verre, XP comprise.
   */
  count: z.number().int().min(0).max(50).optional(),
  status: z.enum(['done', 'skipped', 'failed']).default('done'),
  note: optionalText(300),
});

// --- Taches ------------------------------------------------------------------

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1, 'Titre requis.').max(160),
  description: optionalText(2000),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  status: z.enum(['todo', 'doing', 'done', 'cancelled']).default('todo'),
  dueDate: optionalDate,
  reminderAt: optionalDate,
  estimateMin: z.number().int().min(0).max(1440).nullable().optional(),
  parentId: z.string().nullable().optional(),
  goalId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  tags: tagsSchema,
  xpReward: z.number().int().min(0).max(100).default(5),
});

export const taskUpdateSchema = taskCreateSchema.partial();

// --- Objectifs ---------------------------------------------------------------

export const GOAL_CATEGORIES = [
  'health',
  'career',
  'finance',
  'spiritual',
  'learning',
  'personal',
] as const;

export const goalCreateSchema = z.object({
  title: z.string().trim().min(1, 'Titre requis.').max(160),
  description: optionalText(2000),
  category: z.enum(GOAL_CATEGORIES).default('personal'),
  horizon: z.enum(['short', 'mid', 'long']).default('short'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  status: z.enum(['active', 'paused', 'done', 'abandoned']).default('active'),
  targetValue: z.number().nullable().optional(),
  currentValue: z.number().nullable().optional(),
  unit: optionalText(20),
  deadline: optionalDate,
  parentId: z.string().nullable().optional(),
  color: hexColorSchema.default('#d9c7f0'),
  steps: z.array(z.string().trim().min(1).max(160)).max(50).default([]),
});

export const goalUpdateSchema = goalCreateSchema.partial().omit({ steps: true });

export const goalStepSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  done: z.boolean().optional(),
});

// --- Nutrition ---------------------------------------------------------------

export const mealCreateSchema = z.object({
  date: dateKeySchema,
  type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  name: z.string().trim().min(1, 'Nom requis.').max(120),
  calories: z.number().min(0).max(10000).default(0),
  protein: z.number().min(0).max(1000).default(0),
  carbs: z.number().min(0).max(1000).default(0),
  fat: z.number().min(0).max(1000).default(0),
  fiber: z.number().min(0).max(500).default(0),
  quantity: z.number().min(0.1).max(50).default(1),
  unit: z.string().trim().max(20).default('portion'),
  isTemplate: z.boolean().default(false),
  notes: optionalText(500),
});

export const mealUpdateSchema = mealCreateSchema.partial();

export const waterLogSchema = z.object({
  date: dateKeySchema,
  amountMl: z.number().int().min(-3000).max(3000).default(250),
});

// --- Poids -------------------------------------------------------------------

export const weightSchema = z.object({
  date: dateKeySchema,
  weightKg: z.number().min(20).max(400),
  bodyFat: z.number().min(1).max(70).nullable().optional(),
  muscleKg: z.number().min(1).max(200).nullable().optional(),
  photoUrl: z.string().max(500).nullable().optional(),
  note: optionalText(300),
});

// --- Sport -------------------------------------------------------------------

export const WORKOUT_TYPES = [
  'strength',
  'cardio',
  'walk',
  'run',
  'swim',
  'yoga',
  'other',
] as const;

export const exerciseSchema = z.object({
  name: z.string().trim().min(1).max(80),
  sets: z.number().int().min(0).max(50).default(0),
  reps: z.number().int().min(0).max(500).default(0),
  weightKg: z.number().min(0).max(1000).nullable().optional(),
  restSec: z.number().int().min(0).max(1800).nullable().optional(),
  durationSec: z.number().int().min(0).max(36000).nullable().optional(),
});

export const workoutCreateSchema = z.object({
  date: dateKeySchema,
  name: z.string().trim().min(1, 'Nom requis.').max(120),
  type: z.enum(WORKOUT_TYPES).default('strength'),
  durationMin: z.number().int().min(0).max(1440).default(0),
  distanceKm: z.number().min(0).max(1000).nullable().optional(),
  calories: z.number().min(0).max(20000).nullable().optional(),
  avgHeartRate: z.number().int().min(30).max(240).nullable().optional(),
  intensity: z.enum(['low', 'medium', 'high']).default('medium'),
  notes: optionalText(1000),
  exercises: z.array(exerciseSchema).max(60).default([]),
});

export const workoutUpdateSchema = workoutCreateSchema.partial();

export const focusSessionSchema = z.object({
  date: dateKeySchema,
  minutes: z.number().int().min(1).max(600),
  label: optionalText(120),
  taskId: z.string().nullable().optional(),
});

// --- Journal -----------------------------------------------------------------

export const journalSchema = z.object({
  date: dateKeySchema,
  mood: z.number().int().min(1).max(5).default(3),
  energy: z.number().int().min(1).max(5).default(3),
  title: optionalText(160),
  content: z.string().max(20000).default(''),
  gratitude: optionalText(1000),
  tags: tagsSchema,
  media: z
    .array(
      z.object({
        url: z.string().max(500),
        type: z.enum(['image', 'audio', 'document']),
        name: z.string().max(160),
      }),
    )
    .max(20)
    .default([]),
});

// --- Prieres -----------------------------------------------------------------

export const PRAYER_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;

export const prayerLogSchema = z.object({
  date: dateKeySchema,
  name: z.enum(PRAYER_NAMES),
  status: z.enum(['done', 'late', 'missed']).default('done'),
});

export const prayerSettingsSchema = z.object({
  method: z.number().int().min(0).max(23).optional(),
  school: z.number().int().min(0).max(1).optional(),
  notifyBefore: z.number().int().min(0).max(120).optional(),
  notifications: z.boolean().optional(),
  latitudeAdjustment: z.number().int().min(1).max(3).optional(),
});

// --- Finances / projets / notes / agenda -------------------------------------

export const transactionSchema = z.object({
  date: dateKeySchema,
  type: z.enum(['income', 'expense']),
  category: z.string().trim().max(40).default('other'),
  label: z.string().trim().min(1, 'Libelle requis.').max(120),
  amount: z.number().min(0).max(100_000_000),
  currency: z.string().trim().length(3).default('EUR'),
  recurring: z.boolean().default(false),
  note: optionalText(500),
});

export const transactionUpdateSchema = transactionSchema.partial();

export const projectSchema = z.object({
  name: z.string().trim().min(1, 'Nom requis.').max(120),
  description: optionalText(2000),
  status: z.enum(['active', 'paused', 'done', 'archived']).default('active'),
  color: hexColorSchema.default('#e6e6e6'),
  deadline: optionalDate,
  progress: z.number().int().min(0).max(100).default(0),
});

export const projectUpdateSchema = projectSchema.partial();

export const noteSchema = z.object({
  title: z.string().trim().min(1, 'Titre requis.').max(160),
  content: z.string().max(50000).default(''),
  tags: tagsSchema,
  pinned: z.boolean().default(false),
  color: hexColorSchema.default('#b4b4b4'),
  projectId: z.string().nullable().optional(),
});

export const noteUpdateSchema = noteSchema.partial();

export const calendarEventSchema = z.object({
  title: z.string().trim().min(1, 'Titre requis.').max(160),
  description: optionalText(2000),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  allDay: z.boolean().default(false),
  location: optionalText(200),
  color: hexColorSchema.default('#e9b8d5'),
});

export const calendarEventUpdateSchema = calendarEventSchema.partial();

export type HabitCreateInput = z.infer<typeof habitCreateSchema>;
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type GoalCreateInput = z.infer<typeof goalCreateSchema>;
export type MealCreateInput = z.infer<typeof mealCreateSchema>;
export type WorkoutCreateInput = z.infer<typeof workoutCreateSchema>;
