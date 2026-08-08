'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { api, useResource } from '@/lib/client/api';
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
  low: '#7d8f95',
  medium: '#5f9aa6',
  high: '#d99a63',
  urgent: '#c97f63',
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

  const [scope, setScope] = useState<(typeof SCOPES)[number]>('today');
  const [showDone, setShowDone] = useState(false);
  const { data, loading, refresh } = useResource<Task[]>(`/api/tasks?scope=${scope}`, [scope]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

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

    try {
      if (editing) await api.patch(`/api/tasks/${editing.id}`, payload);
      else await api.post('/api/tasks', payload);
      toast.success(t('common.success'));
      setModalOpen(false);
      void refresh();
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(task: Task) {
    await api
      .patch(`/api/tasks/${task.id}`, { status: task.status === 'done' ? 'todo' : 'done' })
      .catch(() => toast.error(t('common.error')));
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
      <motion.li
        key={task.id}
        layout
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, height: 0 }}
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
              done ? 'border-transparent bg-[#6fa394] text-[var(--on-glow)]' : 'border-[var(--border-strong)] hover:border-[#6fa394]',
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

          <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
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
      </motion.li>
    );
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t('tasks.title')}
        subtitle={t('tasks.subtitle')}
        icon="checkCircle"
        color="#5f9aa6"
        actions={
          <Button icon="plus" onClick={() => openCreate()}>
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
          <Field label="Titre" htmlFor="task-title" required>
            <Input id="task-title" value={form.title} onChange={(event) => set('title', event.target.value)} autoFocus />
          </Field>

          <Field label={t('common.notes')} htmlFor="task-description">
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
            <Field label={t('tasks.dueDate')} htmlFor="task-due">
              <Input id="task-due" type="date" value={form.dueDate} onChange={(event) => set('dueDate', event.target.value)} />
            </Field>
          </div>

          <Field label={t('tasks.estimate')} htmlFor="task-estimate" hint={t('common.optional')}>
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
