'use client';

import { AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { api, useResource } from '@/lib/client/api';
import { useHydrated } from '@/lib/client/hydrated';
import { useMutate } from '@/lib/client/mutate';
import { Badge, Button, Card, EmptyState, Field, Input, Select, Skeleton, Textarea, cx } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { PageHeader } from '@/components/page-header';
import { useI18n } from '@/i18n/provider';

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'todo' | 'doing' | 'done' | 'cancelled';
  dueDate: string | null;
  estimateMin: number | null;
  tags: string[];
  subtasks: Task[];
  goal: { id: string; title: string; color: string } | null;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: '#b4b4b4',
  medium: '#e6e6e6',
  high: '#ff9fbf',
  urgent: '#ff9fbf',
};

const SCOPES = ['today', 'week', 'month', 'overdue', 'all'] as const;

const EMPTY_FORM = {
  title: '',
  description: '',
  priority: 'medium' as Task['priority'],
  dueDate: '',
  estimateMin: '',
};

export default function TasksPage() {
  const { t, locale } = useI18n();
  const toast = useToast();
  const { run: mutate, fields: erreurs, clearField } = useMutate();
  // Ouvrir un formulaire de creation ne demande aucune donnee.
  const pret = useHydrated();

  const [scope, setScope] = useState<(typeof SCOPES)[number]>('today');
  const [showDone, setShowDone] = useState(false);
  const { data, loading, refresh } = useResource<Task[]>(`/api/tasks?scope=${scope}`, [scope]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    // Reprendre un champ efface son message d'erreur.
    clearField(String(key));
  };

  const visible = (data ?? []).filter((task) => showDone || task.status !== 'done');

  const scopeLabels: Record<(typeof SCOPES)[number], string> = {
    today: t('common.today'),
    week: t('tasks.thisWeek'),
    month: t('tasks.thisMonth'),
    overdue: t('tasks.overdue'),
    all: t('common.all'),
  };

  function openCreate(parent: string | null = null) {
    setEditing(null);
    setParentId(parent);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(task: Task) {
    setEditing(task);
    setParentId(null);
    setForm({
      title: task.title,
      description: task.description ?? '',
      priority: task.priority,
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
      estimateMin: task.estimateMin ? String(task.estimateMin) : '',
    });
    setModalOpen(true);
  }

  async function save() {
    if (form.title.trim().length === 0) return;
    setSaving(true);

    const payload = {
      title: form.title,
      description: form.description || null,
      priority: form.priority,
      dueDate: form.dueDate ? `${form.dueDate}T12:00:00` : null,
      estimateMin: form.estimateMin ? Number(form.estimateMin) : null,
      ...(parentId ? { parentId } : {}),
    };

    // Le message d'echec vient du serveur quand il en fournit un : « Titre
    // requis » est plus utile qu'un « Une erreur est survenue » generique.
    const saved = await mutate(() =>
      editing ? api.patch(`/api/tasks/${editing.id}`, payload) : api.post('/api/tasks', payload),
    );
    setSaving(false);
    if (!saved) return;
    setModalOpen(false);
    void refresh();
  }

  async function toggle(task: Task) {
    await mutate(
      () => api.patch(`/api/tasks/${task.id}`, { status: task.status === 'done' ? 'todo' : 'done' }),
      { notifySuccess: false },
    );
    void refresh();
  }

  async function remove(task: Task) {
    if (!window.confirm(t('common.deleteConfirm'))) return;
    await api.delete(`/api/tasks/${task.id}`).catch(() => toast.error(t('common.error')));
    void refresh();
  }

  const renderTask = (task: Task, depth = 0) => {
    const done = task.status === 'done';
    const overdue = task.dueDate && !done && new Date(task.dueDate) < new Date();

    return (
      <li
        key={task.id}
        style={{ marginInlineStart: depth * 24 }}
      >
        <div
          className={cx(
            'group flex items-start gap-3 rounded-xl border p-3 transition-colors',
            done ? 'border-transparent bg-[var(--surface-2)]' : 'border-[var(--border)] hover:border-[var(--border-strong)]',
          )}
        >
          <button
            type="button"
            onClick={() => toggle(task)}
            aria-pressed={done}
            aria-label={done ? t('habits.markUndone') : t('habits.markDone')}
            className={cx(
              'mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 transition-all',
              done ? 'border-transparent bg-[#f6d9e4] text-[var(--on-pink)]' : 'border-[var(--border-strong)] hover:border-[#f6d9e4]',
            )}
          >
            {done && <Icon name="check" size={12} />}
          </button>

          <div className="min-w-0 flex-1">
            <p className={cx('text-sm', done ? 'text-[var(--text-faint)] line-through' : 'text-[var(--text)]')}>
              {task.title}
            </p>
            {task.description && (
              <p className="mt-0.5 line-clamp-2 text-xs text-[var(--text-faint)]">{task.description}</p>
            )}

            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge color={PRIORITY_COLORS[task.priority]}>
                {t(`tasks.priority${task.priority.charAt(0).toUpperCase()}${task.priority.slice(1)}` as 'tasks.priorityLow')}
              </Badge>
              {task.dueDate && (
                <span className={cx('flex items-center gap-1 text-[11px]', overdue ? 'text-red-500' : 'text-[var(--text-faint)]')}>
                  <Icon name="calendar" size={11} />
                  {new Date(task.dueDate).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                </span>
              )}
              {task.estimateMin && (
                <span className="flex items-center gap-1 text-[11px] text-[var(--text-faint)]">
                  <Icon name="clock" size={11} />
                  {task.estimateMin} min
                </span>
              )}
              {task.goal && <Badge color={task.goal.color}>{task.goal.title}</Badge>}
            </div>
          </div>

          <div className="flex shrink-0 gap-0.5 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
            {depth === 0 && (
              <button
                type="button"
                onClick={() => openCreate(task.id)}
                aria-label={t('tasks.subtasks')}
                className="grid size-7 place-items-center rounded-lg text-[var(--text-faint)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
              >
                <Icon name="plus" size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={() => openEdit(task)}
              aria-label={t('common.edit')}
              className="grid size-7 place-items-center rounded-lg text-[var(--text-faint)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
            >
              <Icon name="edit" size={14} />
            </button>
            <button
              type="button"
              onClick={() => remove(task)}
              aria-label={t('common.delete')}
              className="grid size-7 place-items-center rounded-lg text-[var(--text-faint)] transition-colors hover:bg-red-500/10 hover:text-red-500"
            >
              <Icon name="trash" size={14} />
            </button>
          </div>
        </div>

        {task.subtasks.length > 0 && (
          <ul className="mt-1.5 space-y-1.5">{task.subtasks.map((subtask) => renderTask(subtask, depth + 1))}</ul>
        )}
      </li>
    );
  };

  return (
    <div className="lm-entree mx-auto max-w-4xl">
      <PageHeader
        title={t('tasks.title')}
        subtitle={t('tasks.subtitle')}
        icon="checkCircle"
        color="#e6e6e6"
        actions={
          <Button icon="plus" loading={!pret} onClick={() => openCreate()}>
            {t('tasks.new')}
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
          {SCOPES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setScope(value)}
              aria-pressed={scope === value}
              className={cx(
                'rounded-lg px-3 py-1.5 text-[13px] transition-colors',
                scope === value
                  ? 'bg-[var(--surface-2)] font-medium text-[var(--text)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]',
              )}
            >
              {scopeLabels[value]}
            </button>
          ))}
        </div>

        <Button variant="ghost" size="sm" onClick={() => setShowDone((value) => !value)}>
          {showDone ? t('common.all') : t('tasks.completed')}
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon="checkCircle"
            title={t('tasks.empty')}
            action={
              <Button icon="plus" onClick={() => openCreate()}>
                {t('tasks.new')}
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>{visible.map((task) => renderTask(task))}</AnimatePresence>
        </ul>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t('common.edit') : parentId ? t('tasks.subtasks') : t('tasks.new')}
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
          <Field label="Titre" htmlFor="task-title" error={erreurs.title} required>
            <Input id="task-title" value={form.title} onChange={(event) => set('title', event.target.value)} autoFocus />
          </Field>

          <Field label={t('common.notes')} htmlFor="task-description" error={erreurs.description}>
            <Textarea id="task-description" rows={3} value={form.description} onChange={(event) => set('description', event.target.value)} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('common.priority')} htmlFor="task-priority">
              <Select id="task-priority" value={form.priority} onChange={(event) => set('priority', event.target.value as Task['priority'])}>
                <option value="low">{t('tasks.priorityLow')}</option>
                <option value="medium">{t('tasks.priorityMedium')}</option>
                <option value="high">{t('tasks.priorityHigh')}</option>
                <option value="urgent">{t('tasks.priorityUrgent')}</option>
              </Select>
            </Field>
            <Field label={t('tasks.dueDate')} htmlFor="task-due" error={erreurs.dueDate}>
              <Input id="task-due" type="date" value={form.dueDate} onChange={(event) => set('dueDate', event.target.value)} />
            </Field>
          </div>

          <Field label={t('tasks.estimate')} htmlFor="task-estimate" error={erreurs.estimateMin} hint={t('common.optional')}>
            <Input
              id="task-estimate"
              type="number"
              min={0}
              max={1440}
              value={form.estimateMin}
              onChange={(event) => set('estimateMin', event.target.value)}
              placeholder="30"
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
