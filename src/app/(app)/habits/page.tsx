'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { api, useResource } from '@/lib/client/api';
import { useMutate } from '@/lib/client/mutate';
import { Badge, Button, Card, EmptyState, Field, Input, Select, Skeleton, Textarea, Toggle, cx } from '@/components/ui/primitives';
import { HABIT_ICONS, Icon, type IconName } from '@/components/ui/icons';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/page-header';
import { useI18n } from '@/i18n/provider';
import { HABIT_CATEGORIES } from '@/lib/validation/modules';
import { dateKeyIn } from '@/lib/date';

interface Habit {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  category: string;
  targetPerDay: number;
  unit: string | null;
  importance: number;
  xpReward: number;
  reminderAt: string | null;
  isNegative: boolean;
  archived: boolean;
  streak: number;
  completionRate: number;
  todayLog: { status: string; count: number } | null;
  history: Array<{ date: string; done: boolean }>;
}

const COLORS = ['#e9b8d5', '#fbc7da', '#f6d9e4', '#ff9fbf', '#d9c7f0', '#e6e6e6', '#efc4e2', '#dcc7ea'];

const EMPTY_FORM = {
  name: '',
  description: '',
  icon: 'check',
  color: '#e9b8d5',
  category: 'other',
  targetPerDay: 1,
  unit: '',
  importance: 2,
  xpReward: 10,
  reminderAt: '',
  isNegative: false,
};

export default function HabitsPage() {
  const { t } = useI18n();
  const { run: mutate, fields: erreurs, clearField } = useMutate();
  const [showArchived, setShowArchived] = useState(false);
  const { data, loading, refresh } = useResource<Habit[]>(
    `/api/habits?archived=${showArchived}`,
    [showArchived],
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const today = dateKeyIn(Intl.DateTimeFormat().resolvedOptions().timeZone);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    // Reprendre un champ efface son message d'erreur.
    clearField(String(key));
  };

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(habit: Habit) {
    setEditing(habit);
    setForm({
      name: habit.name,
      description: habit.description ?? '',
      icon: habit.icon,
      color: habit.color,
      category: habit.category,
      targetPerDay: habit.targetPerDay,
      unit: habit.unit ?? '',
      importance: habit.importance,
      xpReward: habit.xpReward,
      reminderAt: habit.reminderAt ?? '',
      isNegative: habit.isNegative,
    });
    setModalOpen(true);
  }

  async function save() {
    if (form.name.trim().length === 0) return;
    setSaving(true);
    const payload = {
      ...form,
      description: form.description || null,
      unit: form.unit || null,
      reminderAt: form.reminderAt || null,
    };

    // Le detail par champ renvoye par le serveur s'affiche sous le champ
    // fautif ; la fenetre reste ouverte pour que la saisie soit corrigible.
    const saved = await mutate(() => (editing ? api.patch(`/api/habits/${editing.id}`, payload) : api.post('/api/habits', payload)));
    setSaving(false);
    if (!saved) return;

    setModalOpen(false);
    void refresh();
  }

  async function toggle(habit: Habit) {
    const done = habit.todayLog?.status === 'done';
    await mutate(
      () =>
        api.post(`/api/habits/${habit.id}/log`, {
          date: today,
          count: done ? 0 : habit.targetPerDay,
          status: done ? 'skipped' : 'done',
        }),
      { notifySuccess: false },
    );
    void refresh();
  }

  /** Incremente une habitude a objectif multiple (ex. 8 verres d'eau). */
  async function increment(habit: Habit) {
    const next = Math.min(habit.targetPerDay, (habit.todayLog?.count ?? 0) + 1);
    await mutate(
      () =>
        api.post(`/api/habits/${habit.id}/log`, {
          date: today,
          count: next,
          status: next >= habit.targetPerDay ? 'done' : 'skipped',
        }),
      { notifySuccess: false },
    );
    void refresh();
  }

  async function remove(habit: Habit) {
    if (!window.confirm(t('common.deleteConfirm'))) return;
    const deleted = await mutate(() => api.delete(`/api/habits/${habit.id}`));
    if (deleted !== null) void refresh();
  }

  async function archive(habit: Habit) {
    const saved = await mutate(() => api.patch(`/api/habits/${habit.id}`, { archived: !habit.archived }));
    if (saved) void refresh();
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={t('habits.title')}
        subtitle={t('habits.subtitle')}
        icon="flame"
        color="#e9b8d5"
        actions={
          <>
            <Button variant="secondary" size="sm" disabled={loading} onClick={() => setShowArchived((value) => !value)}>
              {showArchived ? t('common.all') : t('habits.archived')}
            </Button>
            <Button icon="plus" disabled={loading} onClick={openCreate}>
              {t('habits.new')}
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <Card>
          <EmptyState
            icon="flame"
            title={t('habits.empty')}
            hint={t('common.emptyHint')}
            action={
              <Button icon="plus" onClick={openCreate}>
                {t('habits.new')}
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {data.map((habit, index) => {
            const done = habit.todayLog?.status === 'done';
            const count = habit.todayLog?.count ?? 0;
            const multi = habit.targetPerDay > 1;

            return (
              <motion.div
                key={habit.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.03 }}
              >
                <Card className={cx('h-full', habit.archived && 'opacity-60')}>
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => (multi ? increment(habit) : toggle(habit))}
                      aria-pressed={done}
                      aria-label={done ? t('habits.markUndone') : t('habits.markDone')}
                      className="grid size-11 shrink-0 place-items-center rounded-xl transition-all hover:scale-105"
                      style={{
                        background: done ? habit.color : `${habit.color}1a`,
                        color: done ? '#fff' : habit.color,
                      }}
                    >
                      <Icon name={done ? 'check' : (habit.icon as IconName)} size={20} />
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className={cx('truncate text-[15px] font-medium', done ? 'text-[var(--text-faint)] line-through' : 'text-[var(--text)]')}>
                          {habit.name}
                        </h2>
                        <div className="flex shrink-0 gap-0.5">
                          <button
                            type="button"
                            onClick={() => openEdit(habit)}
                            aria-label={t('common.edit')}
                            className="grid size-7 place-items-center rounded-lg text-[var(--text-faint)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                          >
                            <Icon name="edit" size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => archive(habit)}
                            aria-label={t('habits.archive')}
                            className="grid size-7 place-items-center rounded-lg text-[var(--text-faint)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                          >
                            <Icon name="download" size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(habit)}
                            aria-label={t('common.delete')}
                            className="grid size-7 place-items-center rounded-lg text-[var(--text-faint)] transition-colors hover:bg-red-500/10 hover:text-red-500"
                          >
                            <Icon name="trash" size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge color={habit.color}>{t(`habits.category${habit.category.charAt(0).toUpperCase()}${habit.category.slice(1)}` as 'habits.categoryOther')}</Badge>
                        {habit.isNegative && <Badge color="#ff9fbf">{t('habits.negative')}</Badge>}
                        {multi && (
                          <span className="text-[11px] text-[var(--text-faint)]">
                            {count}/{habit.targetPerDay} {habit.unit}
                          </span>
                        )}
                        {habit.reminderAt && (
                          <span className="flex items-center gap-1 text-[11px] text-[var(--text-faint)]">
                            <Icon name="clock" size={11} />
                            {habit.reminderAt}
                          </span>
                        )}
                      </div>

                      {/* Historique des 30 derniers jours, du plus ancien au plus recent. */}
                      <div className="mt-3 flex gap-[3px]">
                        {habit.history.slice(-30).map((day) => (
                          <span
                            key={day.date}
                            title={day.date}
                            className="h-4 flex-1 rounded-[2px]"
                            style={{ background: day.done ? habit.color : 'var(--surface-2)' }}
                          />
                        ))}
                      </div>

                      <div className="mt-2.5 flex items-center justify-between text-[11px] text-[var(--text-faint)]">
                        <span className="flex items-center gap-1">
                          <Icon name="flame" size={12} className="text-[#ff9fbf]" />
                          {habit.streak} {t('habits.streakDays')}
                        </span>
                        <span>
                          {habit.completionRate}% · +{habit.xpReward} XP
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t('common.edit') : t('habits.new')}
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
          <Field label={t('common.name')} htmlFor="habit-name" error={erreurs.name} hint={`${form.name.length}/80`} required>
            <Input
              id="habit-name"
              invalid={Boolean(erreurs.name)}
              maxLength={80}
              value={form.name}
              onChange={(event) => set('name', event.target.value)}
              placeholder="Ex : lire 20 minutes"
              autoFocus
            />
          </Field>

          <Field label={t('common.notes')} htmlFor="habit-description" error={erreurs.description}>
            <Textarea
              id="habit-description"
              rows={2}
              value={form.description}
              onChange={(event) => set('description', event.target.value)}
            />
          </Field>

          <Field label={t('habits.icon')}>
            <div className="flex flex-wrap gap-1.5">
              {HABIT_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => set('icon', icon)}
                  aria-label={icon}
                  aria-pressed={form.icon === icon}
                  className={cx(
                    'grid size-9 place-items-center rounded-lg border transition-all',
                    form.icon === icon
                      ? 'border-transparent text-[var(--on-pink)]'
                      : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)]',
                  )}
                  style={form.icon === icon ? { background: form.color } : undefined}
                >
                  <Icon name={icon} size={16} />
                </button>
              ))}
            </div>
          </Field>

          <Field label={t('habits.color')}>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => set('color', color)}
                  aria-label={color}
                  aria-pressed={form.color === color}
                  className={cx(
                    'size-8 rounded-lg transition-transform',
                    form.color === color && 'scale-110 ring-2 ring-offset-2 ring-offset-[var(--surface)]',
                  )}
                  style={{ background: color, boxShadow: form.color === color ? `0 0 0 2px ${color}` : undefined }}
                />
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('common.category')} htmlFor="habit-category">
              <Select id="habit-category" value={form.category} onChange={(event) => set('category', event.target.value)}>
                {HABIT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {t(`habits.category${category.charAt(0).toUpperCase()}${category.slice(1)}` as 'habits.categoryOther')}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('habits.timesPerDay')} htmlFor="habit-target" error={erreurs.targetPerDay}>
              <Input
                id="habit-target"
                type="number"
                min={1}
                max={50}
                value={form.targetPerDay}
                onChange={(event) => set('targetPerDay', Math.max(1, Number(event.target.value)))}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Unite" htmlFor="habit-unit" error={erreurs.unit} hint={t('common.optional')}>
              <Input id="habit-unit" value={form.unit} onChange={(event) => set('unit', event.target.value)} placeholder="verres, pages..." />
            </Field>
            <Field label={t('habits.reminder')} htmlFor="habit-reminder" error={erreurs.reminderAt} hint={t('common.optional')}>
              <Input id="habit-reminder" type="time" value={form.reminderAt} onChange={(event) => set('reminderAt', event.target.value)} />
            </Field>
          </div>

          <Field label={`${t('dash.xp')} (${form.xpReward})`} htmlFor="habit-xp" error={erreurs.xpReward}>
            <input
              id="habit-xp"
              type="range"
              min={5}
              max={30}
              step={5}
              value={form.xpReward}
              onChange={(event) => set('xpReward', Number(event.target.value))}
              className="w-full accent-brand-500"
            />
          </Field>

          <Toggle
            checked={form.isNegative}
            onChange={(value) => set('isNegative', value)}
            label={t('habits.negative')}
            description={t('habits.negativeHint')}
          />
        </div>
      </Modal>
    </div>
  );
}
