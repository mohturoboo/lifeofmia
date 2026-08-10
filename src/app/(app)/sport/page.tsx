'use client';

import { useState } from 'react';
import { api, useResource } from '@/lib/client/api';
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Select, Skeleton, Textarea } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { Modal } from '@/components/ui/modal';
import { BarChart, DonutChart } from '@/components/charts';
import { useToast } from '@/components/ui/toast';
import { PageHeader } from '@/components/page-header';
import { useI18n } from '@/i18n/provider';
import { dateKeyIn } from '@/lib/date';
import { WORKOUT_TYPES } from '@/lib/validation/modules';

interface Exercise {
  id?: string;
  name: string;
  sets: number;
  reps: number;
  weightKg: number | null;
  restSec: number | null;
}

interface Workout {
  id: string;
  date: string;
  name: string;
  type: string;
  durationMin: number;
  distanceKm: number | null;
  calories: number | null;
  intensity: string;
  notes: string | null;
  aiGenerated: boolean;
  exercises: Exercise[];
}

interface SportData {
  workouts: Workout[];
  totals: { sessions: number; minutes: number; distanceKm: number; calories: number };
  byType: Record<string, number>;
  monthly: Array<{ date: string; minutes: number }>;
}

const INTENSITY_COLORS: Record<string, string> = { low: '#e6e6e6', medium: '#ff9fbf', high: '#ff9fbf' };

const EMPTY_EXERCISE: Exercise = { name: '', sets: 3, reps: 10, weightKg: null, restSec: 60 };

export default function SportPage() {
  const { t, locale, n } = useI18n();
  const toast = useToast();
  const { data, loading, refresh } = useResource<SportData>('/api/workouts');

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: dateKeyIn(Intl.DateTimeFormat().resolvedOptions().timeZone),
    name: '',
    type: 'strength',
    durationMin: '45',
    distanceKm: '',
    calories: '',
    intensity: 'medium',
    notes: '',
    exercises: [{ ...EMPTY_EXERCISE }] as Exercise[],
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const typeLabel = (type: string) =>
    t(`sport.type${type.charAt(0).toUpperCase()}${type.slice(1)}` as 'sport.typeOther');

  const isStrength = form.type === 'strength';

  function updateExercise(index: number, patch: Partial<Exercise>) {
    const exercises = [...form.exercises];
    exercises[index] = { ...exercises[index], ...patch };
    set('exercises', exercises);
  }

  async function save() {
    if (form.name.trim().length === 0) return;
    setSaving(true);

    try {
      await api.post('/api/workouts', {
        date: form.date,
        name: form.name,
        type: form.type,
        durationMin: Number(form.durationMin) || 0,
        distanceKm: form.distanceKm ? Number(form.distanceKm) : null,
        calories: form.calories ? Number(form.calories) : null,
        intensity: form.intensity,
        notes: form.notes || null,
        exercises: isStrength ? form.exercises.filter((exercise) => exercise.name.trim().length > 0) : [],
      });
      toast.success(t('common.success'));
      setModalOpen(false);
      set('name', '');
      set('exercises', [{ ...EMPTY_EXERCISE }]);
      void refresh();
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  async function remove(workout: Workout) {
    if (!window.confirm(t('common.deleteConfirm'))) return;
    await api.delete(`/api/workouts/${workout.id}`).catch(() => toast.error(t('common.error')));
    void refresh();
  }

  if (loading || !data) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t('sport.title')}
        subtitle={t('sport.subtitle')}
        icon="dumbbell"
        color="#ff9fbf"
        actions={
          <Button icon="plus" onClick={() => setModalOpen(true)}>
            {t('sport.newSession')}
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: t('sport.totalSessions'), value: n(data.totals.sessions), icon: 'dumbbell' as const },
          { label: t('sport.totalTime'), value: `${Math.round(data.totals.minutes / 60)} h`, icon: 'clock' as const },
          { label: t('sport.distance'), value: `${n(data.totals.distanceKm)} km`, icon: 'trending' as const },
          { label: t('nutrition.calories'), value: n(data.totals.calories), icon: 'flame' as const },
        ].map((tile) => (
          <Card key={tile.label}>
            <span className="grid size-8 place-items-center rounded-lg bg-red-500/12 text-red-500">
              <Icon name={tile.icon} size={16} />
            </span>
            <p className="mt-2.5 text-xl font-semibold text-[var(--text)]">{tile.value}</p>
            <p className="text-[11px] text-[var(--text-faint)]">{tile.label}</p>
          </Card>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="30 derniers jours" icon="chart" accent="#ff9fbf" />
          <BarChart
            data={data.monthly.map((day) => ({
              label: day.date.slice(8),
              value: day.minutes,
            }))}
            color="#ff9fbf"
            unit=" min"
            height={150}
          />
        </Card>

        <Card>
          <CardHeader title="Repartition" icon="compare" accent="#ff9fbf" />
          {Object.keys(data.byType).length === 0 ? (
            <p className="py-6 text-center text-xs text-[var(--text-faint)]">{t('sport.empty')}</p>
          ) : (
            <DonutChart
              data={Object.entries(data.byType).map(([type, minutes]) => ({ label: typeLabel(type), value: minutes }))}
              size={130}
              thickness={18}
            />
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title={t('sport.title')} icon="clock" accent="#ff9fbf" />
        {data.workouts.length === 0 ? (
          <EmptyState
            icon="dumbbell"
            title={t('sport.empty')}
            action={
              <Button icon="plus" onClick={() => setModalOpen(true)}>
                {t('sport.newSession')}
              </Button>
            }
          />
        ) : (
          <ul className="space-y-2">
            {data.workouts.map((workout) => (
              <li key={workout.id} className="group rounded-xl border border-[var(--border)] p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--text)]">
                      {workout.name}
                      {workout.aiGenerated && <Icon name="sparkles" size={12} className="text-[var(--brand-text)]" />}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge color="#ff9fbf">{typeLabel(workout.type)}</Badge>
                      <Badge color={INTENSITY_COLORS[workout.intensity]}>
                        {t(`sport.intensity${workout.intensity.charAt(0).toUpperCase()}${workout.intensity.slice(1)}` as 'sport.intensityLow')}
                      </Badge>
                      <span className="text-[11px] text-[var(--text-faint)]">
                        {new Date(`${workout.date}T12:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                        {' · '}
                        {workout.durationMin} min
                        {workout.distanceKm ? ` · ${workout.distanceKm} km` : ''}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => remove(workout)}
                    aria-label={t('common.delete')}
                    className="grid size-7 shrink-0 place-items-center rounded-lg text-[var(--text-faint)] opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </div>

                {workout.exercises.length > 0 && (
                  <ul className="mt-2.5 space-y-1 border-t border-[var(--border)] pt-2.5">
                    {workout.exercises.map((exercise, index) => (
                      <li key={index} className="flex items-center justify-between text-xs">
                        <span className="text-[var(--text-muted)]">{exercise.name}</span>
                        <span className="tabular-nums text-[var(--text-faint)]">
                          {exercise.sets} × {exercise.reps}
                          {exercise.weightKg ? ` · ${exercise.weightKg} kg` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t('sport.newSession')}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={save} loading={saving} disabled={form.name.trim().length === 0}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('common.name')} htmlFor="workout-name" required>
              <Input id="workout-name" value={form.name} onChange={(event) => set('name', event.target.value)} autoFocus />
            </Field>
            <Field label={t('common.date')} htmlFor="workout-date">
              <Input id="workout-date" type="date" value={form.date} onChange={(event) => set('date', event.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Type" htmlFor="workout-type">
              <Select id="workout-type" value={form.type} onChange={(event) => set('type', event.target.value)}>
                {WORKOUT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {typeLabel(type)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={`${t('sport.duration')} (min)`} htmlFor="workout-duration">
              <Input id="workout-duration" type="number" min={0} value={form.durationMin} onChange={(event) => set('durationMin', event.target.value)} />
            </Field>
            <Field label={`${t('sport.distance')} (km)`} htmlFor="workout-distance">
              <Input id="workout-distance" type="number" step="0.1" value={form.distanceKm} onChange={(event) => set('distanceKm', event.target.value)} />
            </Field>
            <Field label={t('sport.intensity')} htmlFor="workout-intensity">
              <Select id="workout-intensity" value={form.intensity} onChange={(event) => set('intensity', event.target.value)}>
                <option value="low">{t('sport.intensityLow')}</option>
                <option value="medium">{t('sport.intensityMedium')}</option>
                <option value="high">{t('sport.intensityHigh')}</option>
              </Select>
            </Field>
          </div>

          {isStrength && (
            <Field label={t('sport.exercises')}>
              <div className="space-y-2">
                {form.exercises.map((exercise, index) => (
                  <div key={index} className="flex items-end gap-2">
                    <Input
                      value={exercise.name}
                      onChange={(event) => updateExercise(index, { name: event.target.value })}
                      placeholder="Exercice"
                      aria-label={`${t('sport.exercises')} ${index + 1}`}
                      className="flex-[2]"
                    />
                    <Input
                      type="number"
                      min={0}
                      value={exercise.sets}
                      onChange={(event) => updateExercise(index, { sets: Number(event.target.value) })}
                      aria-label={t('sport.sets')}
                      className="w-16"
                    />
                    <Input
                      type="number"
                      min={0}
                      value={exercise.reps}
                      onChange={(event) => updateExercise(index, { reps: Number(event.target.value) })}
                      aria-label={t('sport.reps')}
                      className="w-16"
                    />
                    <Input
                      type="number"
                      step="0.5"
                      value={exercise.weightKg ?? ''}
                      onChange={(event) => updateExercise(index, { weightKg: event.target.value ? Number(event.target.value) : null })}
                      placeholder="kg"
                      aria-label={t('sport.weightKg')}
                      className="w-20"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="close"
                      aria-label={t('common.delete')}
                      onClick={() => set('exercises', form.exercises.filter((_, position) => position !== index))}
                    />
                  </div>
                ))}
                <Button
                  variant="secondary"
                  size="sm"
                  icon="plus"
                  onClick={() => set('exercises', [...form.exercises, { ...EMPTY_EXERCISE }])}
                >
                  {t('common.add')}
                </Button>
              </div>
            </Field>
          )}

          <Field label={t('common.notes')} htmlFor="workout-notes">
            <Textarea id="workout-notes" rows={2} value={form.notes} onChange={(event) => set('notes', event.target.value)} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
