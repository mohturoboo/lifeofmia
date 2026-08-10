'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { api, useResource } from '@/lib/client/api';
import { Badge, Button, Card, EmptyState, Field, Input, Progress, Select, Skeleton, Textarea, cx } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { PageHeader } from '@/components/page-header';
import { useI18n } from '@/i18n/provider';
import { GOAL_CATEGORIES } from '@/lib/validation/modules';

interface GoalStep {
  id: string;
  title: string;
  done: boolean;
}

interface Goal {
  id: string;
  title: string;
  description: string | null;
  category: string;
  horizon: 'short' | 'mid' | 'long';
  priority: string;
  status: 'active' | 'paused' | 'done' | 'abandoned';
  progress: number;
  targetValue: number | null;
  currentValue: number | null;
  unit: string | null;
  deadline: string | null;
  color: string;
  steps: GoalStep[];
  tasks: Array<{ id: string; title: string; status: string }>;
}

const HORIZONS = ['short', 'mid', 'long'] as const;
const COLORS = ['#d9c7f0', '#fbc7da', '#f6d9e4', '#ff9fbf', '#e6e6e6', '#efc4e2'];

const EMPTY_FORM = {
  title: '',
  description: '',
  category: 'personal',
  horizon: 'short' as Goal['horizon'],
  priority: 'medium',
  deadline: '',
  targetValue: '',
  currentValue: '',
  unit: '',
  color: '#d9c7f0',
  steps: [''],
};

export default function GoalsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const { data, loading, refresh } = useResource<Goal[]>('/api/goals');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [newStep, setNewStep] = useState<Record<string, string>>({});

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(goal: Goal) {
    setEditing(goal);
    setForm({
      title: goal.title,
      description: goal.description ?? '',
      category: goal.category,
      horizon: goal.horizon,
      priority: goal.priority,
      deadline: goal.deadline ? goal.deadline.slice(0, 10) : '',
      targetValue: goal.targetValue !== null ? String(goal.targetValue) : '',
      currentValue: goal.currentValue !== null ? String(goal.currentValue) : '',
      unit: goal.unit ?? '',
      color: goal.color,
      steps: [''],
    });
    setModalOpen(true);
  }

  async function save() {
    if (form.title.trim().length === 0) return;
    setSaving(true);

    const payload = {
      title: form.title,
      description: form.description || null,
      category: form.category,
      horizon: form.horizon,
      priority: form.priority,
      deadline: form.deadline ? `${form.deadline}T12:00:00` : null,
      targetValue: form.targetValue ? Number(form.targetValue) : null,
      currentValue: form.currentValue ? Number(form.currentValue) : null,
      unit: form.unit || null,
      color: form.color,
    };

    try {
      if (editing) {
        await api.patch(`/api/goals/${editing.id}`, payload);
      } else {
        await api.post('/api/goals', {
          ...payload,
          steps: form.steps.map((step) => step.trim()).filter(Boolean),
        });
      }
      toast.success(t('common.success'));
      setModalOpen(false);
      void refresh();
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleStep(goalId: string, step: GoalStep) {
    await api.patch(`/api/goals/${goalId}/steps`, { stepId: step.id, done: !step.done });
    void refresh();
  }

  async function addStep(goalId: string) {
    const title = (newStep[goalId] ?? '').trim();
    if (!title) return;
    await api.post(`/api/goals/${goalId}/steps`, { title });
    setNewStep((current) => ({ ...current, [goalId]: '' }));
    void refresh();
  }

  async function removeStep(goalId: string, stepId: string) {
    await api.patch(`/api/goals/${goalId}/steps`, { stepId, remove: true });
    void refresh();
  }

  async function complete(goal: Goal) {
    await api.patch(`/api/goals/${goal.id}`, { status: goal.status === 'done' ? 'active' : 'done' });
    if (goal.status !== 'done') toast.success('Objectif atteint ! +200 XP');
    void refresh();
  }

  async function remove(goal: Goal) {
    if (!window.confirm(t('common.deleteConfirm'))) return;
    await api.delete(`/api/goals/${goal.id}`).catch(() => toast.error(t('common.error')));
    void refresh();
  }

  const horizonLabel = { short: t('goals.shortTerm'), mid: t('goals.midTerm'), long: t('goals.longTerm') };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t('goals.title')}
        subtitle={t('goals.subtitle')}
        icon="target"
        color="#d9c7f0"
        actions={
          <Button icon="plus" disabled={loading} onClick={openCreate}>
            {t('goals.new')}
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <Card>
          <EmptyState
            icon="target"
            title={t('goals.empty')}
            hint={t('common.emptyHint')}
            action={
              <Button icon="plus" onClick={openCreate}>
                {t('goals.new')}
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {HORIZONS.map((horizon) => {
            const goals = data.filter((goal) => goal.horizon === horizon);
            if (goals.length === 0) return null;

            return (
              <section key={horizon}>
                <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">
                  {horizonLabel[horizon]} · {goals.length}
                </h2>

                <div className="space-y-3">
                  {goals.map((goal, index) => {
                    const daysLeft = goal.deadline
                      ? Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / 86_400_000)
                      : null;

                    return (
                      <motion.div
                        key={goal.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.04 }}
                      >
                        <Card className={cx(goal.status === 'done' && 'opacity-70')}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="size-2.5 shrink-0 rounded-full" style={{ background: goal.color }} />
                                <h3
                                  className={cx(
                                    'truncate text-[15px] font-medium',
                                    goal.status === 'done' ? 'text-[var(--text-faint)] line-through' : 'text-[var(--text)]',
                                  )}
                                >
                                  {goal.title}
                                </h3>
                              </div>

                              {goal.description && (
                                <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{goal.description}</p>
                              )}

                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                <Badge color={goal.color}>{goal.category}</Badge>
                                {goal.targetValue !== null && (
                                  <Badge color="#b4b4b4">
                                    {goal.currentValue ?? 0} / {goal.targetValue} {goal.unit}
                                  </Badge>
                                )}
                                {daysLeft !== null && (
                                  <span
                                    className={cx(
                                      'flex items-center gap-1 text-[11px]',
                                      daysLeft < 0 ? 'text-red-500' : 'text-[var(--text-faint)]',
                                    )}
                                  >
                                    <Icon name="calendar" size={11} />
                                    {daysLeft < 0 ? t('goals.overdue') : `${daysLeft} ${t('goals.daysLeft')}`}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              <span className="text-lg font-semibold" style={{ color: goal.color }}>
                                {goal.progress}%
                              </span>
                              <div className="flex gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => complete(goal)}
                                  aria-label={t('goals.statusDone')}
                                  className="grid size-7 place-items-center rounded-lg text-[var(--text-faint)] transition-colors hover:bg-[#f6d9e4]/10 hover:text-[#f6d9e4]"
                                >
                                  <Icon name="checkCircle" size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEdit(goal)}
                                  aria-label={t('common.edit')}
                                  className="grid size-7 place-items-center rounded-lg text-[var(--text-faint)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                                >
                                  <Icon name="edit" size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => remove(goal)}
                                  aria-label={t('common.delete')}
                                  className="grid size-7 place-items-center rounded-lg text-[var(--text-faint)] transition-colors hover:bg-red-500/10 hover:text-red-500"
                                >
                                  <Icon name="trash" size={14} />
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="mt-3">
                            <Progress value={goal.progress} color={goal.color} label={goal.title} />
                          </div>

                          {/* Etapes : c'est ce qui rend un objectif actionnable. */}
                          <div className="mt-4 space-y-1.5">
                            {goal.steps.map((step) => (
                              <div key={step.id} className="group flex items-center gap-2.5">
                                <button
                                  type="button"
                                  onClick={() => toggleStep(goal.id, step)}
                                  aria-pressed={step.done}
                                  className={cx(
                                    'grid size-4 shrink-0 place-items-center rounded border-2 transition-all',
                                    step.done ? 'border-transparent text-[var(--on-pink)]' : 'border-[var(--border-strong)]',
                                  )}
                                  style={step.done ? { background: goal.color } : undefined}
                                >
                                  {step.done && <Icon name="check" size={10} />}
                                </button>
                                <span
                                  className={cx(
                                    'min-w-0 flex-1 truncate text-[13px]',
                                    step.done ? 'text-[var(--text-faint)] line-through' : 'text-[var(--text-muted)]',
                                  )}
                                >
                                  {step.title}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeStep(goal.id, step.id)}
                                  aria-label={t('common.delete')}
                                  className="grid size-6 shrink-0 place-items-center rounded text-[var(--text-faint)] opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                                >
                                  <Icon name="close" size={12} />
                                </button>
                              </div>
                            ))}

                            <div className="flex items-center gap-2 pt-1">
                              <Icon name="plus" size={13} className="shrink-0 text-[var(--text-faint)]" />
                              <input
                                value={newStep[goal.id] ?? ''}
                                onChange={(event) => setNewStep((current) => ({ ...current, [goal.id]: event.target.value }))}
                                onKeyDown={(event) => event.key === 'Enter' && addStep(goal.id)}
                                onBlur={() => addStep(goal.id)}
                                placeholder={t('goals.addStep')}
                                aria-label={t('goals.addStep')}
                                className="flex-1 bg-transparent text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none"
                              />
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t('common.edit') : t('goals.new')}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={save} loading={saving} disabled={form.title.trim().length === 0}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Titre" htmlFor="goal-title" required>
            <Input id="goal-title" value={form.title} onChange={(event) => set('title', event.target.value)} autoFocus />
          </Field>

          <Field label={t('common.notes')} htmlFor="goal-description">
            <Textarea id="goal-description" rows={2} value={form.description} onChange={(event) => set('description', event.target.value)} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('common.category')} htmlFor="goal-category">
              <Select id="goal-category" value={form.category} onChange={(event) => set('category', event.target.value)}>
                {GOAL_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Horizon" htmlFor="goal-horizon">
              <Select id="goal-horizon" value={form.horizon} onChange={(event) => set('horizon', event.target.value as Goal['horizon'])}>
                <option value="short">{t('goals.shortTerm')}</option>
                <option value="mid">{t('goals.midTerm')}</option>
                <option value="long">{t('goals.longTerm')}</option>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Actuel" htmlFor="goal-current">
              <Input id="goal-current" type="number" value={form.currentValue} onChange={(event) => set('currentValue', event.target.value)} />
            </Field>
            <Field label="Cible" htmlFor="goal-target">
              <Input id="goal-target" type="number" value={form.targetValue} onChange={(event) => set('targetValue', event.target.value)} />
            </Field>
            <Field label="Unite" htmlFor="goal-unit">
              <Input id="goal-unit" value={form.unit} onChange={(event) => set('unit', event.target.value)} placeholder="kg" />
            </Field>
          </div>

          <Field label={t('goals.deadline')} htmlFor="goal-deadline">
            <Input id="goal-deadline" type="date" value={form.deadline} onChange={(event) => set('deadline', event.target.value)} />
          </Field>

          <Field label={t('habits.color')}>
            <div className="flex gap-2">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => set('color', color)}
                  aria-label={color}
                  aria-pressed={form.color === color}
                  className={cx('size-8 rounded-lg transition-transform', form.color === color && 'scale-110')}
                  style={{ background: color, boxShadow: form.color === color ? `0 0 0 2px ${color}` : undefined }}
                />
              ))}
            </div>
          </Field>

          {!editing && (
            <Field label={t('goals.steps')} hint="Un objectif sans etapes reste un souhait.">
              <div className="space-y-2">
                {form.steps.map((step, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={step}
                      onChange={(event) => {
                        const steps = [...form.steps];
                        steps[index] = event.target.value;
                        set('steps', steps);
                      }}
                      placeholder={`${t('goals.steps')} ${index + 1}`}
                      aria-label={`${t('goals.steps')} ${index + 1}`}
                    />
                    {form.steps.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon="close"
                        onClick={() => set('steps', form.steps.filter((_, position) => position !== index))}
                        aria-label={t('common.delete')}
                      />
                    )}
                  </div>
                ))}
                <Button variant="secondary" size="sm" icon="plus" onClick={() => set('steps', [...form.steps, ''])}>
                  {t('goals.addStep')}
                </Button>
              </div>
            </Field>
          )}
        </div>
      </Modal>
    </div>
  );
}
