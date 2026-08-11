'use client';

import { useState } from 'react';
import { api, useResource } from '@/lib/client/api';
import { useMutate } from '@/lib/client/mutate';
import { Button, Card, EmptyState, Field, Input, Skeleton, Textarea, cx } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { PageHeader } from '@/components/page-header';
import { useI18n } from '@/i18n/provider';

interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  color: string;
  updatedAt: string;
}

const COLORS = ['#b4b4b4', '#e9b8d5', '#fbc7da', '#f6d9e4', '#ff9fbf', '#d9c7f0'];

export default function NotesPage() {
  const { t, locale } = useI18n();
  const toast = useToast();
  const { run: mutate, fields: erreurs, clearField } = useMutate();

  const [query, setQuery] = useState('');
  const { data, loading, refresh } = useResource<Note[]>(
    `/api/notes${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`,
    [query],
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', color: '#b4b4b4' });

  const set = <K extends keyof typeof form>(key: K, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    // Reprendre un champ efface son message d'erreur.
    clearField(String(key));
  };

  function openCreate() {
    setEditing(null);
    setForm({ title: '', content: '', color: '#b4b4b4' });
    setModalOpen(true);
  }

  function openEdit(note: Note) {
    setEditing(note);
    setForm({ title: note.title, content: note.content, color: note.color });
    setModalOpen(true);
  }

  async function save() {
    if (form.title.trim().length === 0) return;
    setSaving(true);
    try {
      const payload = { title: form.title, content: form.content, color: form.color, tags: [] };
      if (editing) await api.patch(`/api/notes/${editing.id}`, payload);
      else await api.post('/api/notes', payload);
      toast.success(t('common.success'));
      setModalOpen(false);
      void refresh();
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  // Epinglage : geste rapide et repete, on ne confirme pas la reussite.
  async function togglePin(note: Note) {
    const saved = await mutate(
      () => api.patch(`/api/notes/${note.id}`, { pinned: !note.pinned }),
      { notifySuccess: false },
    );
    if (saved) void refresh();
  }

  async function remove(note: Note) {
    if (!window.confirm(t('common.deleteConfirm'))) return;
    await api.delete(`/api/notes/${note.id}`).catch(() => toast.error(t('common.error')));
    void refresh();
  }

  return (
    <div className="lm-entree mx-auto max-w-5xl">
      <PageHeader
        title={t('notes.title')}
        subtitle={t('notes.subtitle')}
        icon="note"
        color="#b4b4b4"
        actions={
          <>
            <div className="relative">
              <Icon
                name="search"
                size={15}
                className="pointer-events-none absolute inset-y-0 start-3 my-auto text-[var(--text-faint)]"
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('common.search')}
                aria-label={t('common.search')}
                className="w-44 ps-9"
              />
            </div>
            <Button icon="plus" onClick={openCreate}>
              {t('notes.new')}
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <Skeleton key={index} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <Card>
          <EmptyState
            icon="note"
            title={t('notes.empty')}
            hint={t('common.emptyHint')}
            action={
              <Button icon="plus" onClick={openCreate}>
                {t('notes.new')}
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((note) => (
            <article
              key={note.id}
              className="lm-card group relative flex h-48 flex-col overflow-hidden p-4"
              style={{ borderTopColor: note.color, borderTopWidth: 3 }}
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--text)]">{note.title}</h2>
                <div className="flex shrink-0 gap-0.5">
                  <button
                    type="button"
                    onClick={() => togglePin(note)}
                    aria-label={t('notes.pin')}
                    aria-pressed={note.pinned}
                    className={cx(
                      'grid size-7 place-items-center rounded-lg transition-colors',
                      note.pinned
                        ? 'text-[#ff9fbf]'
                        : 'text-[var(--text-faint)] sm:opacity-0 sm:group-hover:opacity-100 hover:text-[var(--text)]',
                    )}
                  >
                    <Icon name="award" size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(note)}
                    aria-label={t('common.delete')}
                    className="grid size-7 place-items-center rounded-lg text-[var(--text-faint)] transition-opacity sm:opacity-0 hover:text-red-500 sm:group-hover:opacity-100"
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => openEdit(note)}
                className="mt-2 min-h-0 flex-1 overflow-hidden text-start"
              >
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-muted)]">
                  {note.content.slice(0, 260)}
                </p>
              </button>

              <p className="mt-2 shrink-0 text-[10px] text-[var(--text-faint)]">
                {new Date(note.updatedAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
              </p>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={save}
        title={editing ? t('common.edit') : t('notes.new')}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" onClick={save} loading={saving} disabled={form.title.trim().length === 0}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Titre" htmlFor="note-title" error={erreurs.title} required>
            <Input id="note-title" value={form.title} onChange={(event) => set('title', event.target.value)} autoFocus />
          </Field>

          <Field label={t('common.notes')} htmlFor="note-content" error={erreurs.content}>
            <Textarea
              id="note-content"
              rows={12}
              value={form.content}
              onChange={(event) => set('content', event.target.value)}
              className="leading-relaxed"
            />
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
        </div>
      </Modal>
    </div>
  );
}
