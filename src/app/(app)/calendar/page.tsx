'use client';

import { useMemo, useState } from 'react';
import { api, useResource } from '@/lib/client/api';
import { useMutate } from '@/lib/client/mutate';
import { Button, Card, cx, Field, IconButton, Input, Skeleton, Textarea } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { PageHeader } from '@/components/page-header';
import { useI18n } from '@/i18n/provider';
import { FIN_AVANT_DEBUT } from '@/lib/validation/common';

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  location: string | null;
  color: string;
}

interface CalendarData {
  events: CalendarEvent[];
  tasks: Array<{ id: string; title: string; dueDate: string; status: string; priority: string }>;
}

const COLORS = ['#e9b8d5', '#fbc7da', '#f6d9e4', '#ff9fbf', '#d9c7f0', '#e6e6e6'];

export default function CalendarPage() {
  const { t, locale } = useI18n();
  const toast = useToast();
  const { run: mutate, fields: erreurs, clearField, setField: setErreur } = useMutate();

  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState<string | null>(null);

  const range = useMemo(() => {
    const from = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
    const to = new Date(cursor.getFullYear(), cursor.getMonth() + 2, 0);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [cursor]);

  const { data, loading, refresh } = useResource<CalendarData>(
    `/api/events?from=${range.from}&to=${range.to}`,
    [range.from, range.to],
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    date: new Date().toISOString().slice(0, 10),
    startTime: '09:00',
    endTime: '10:00',
    location: '',
    color: '#e9b8d5',
  });

  const set = <K extends keyof typeof form>(key: K, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    // Reprendre un champ efface son message d'erreur.
    clearField(String(key));
  };

  /**
   * Grille du mois : 6 semaines de 7 jours, commencant un lundi.
   * Les jours des mois voisins sont affiches en grise pour eviter les trous.
   */
  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(start.getDate() - offset);

    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return {
        key: day.toISOString().slice(0, 10),
        day: day.getDate(),
        inMonth: day.getMonth() === cursor.getMonth(),
        isToday: day.toDateString() === new Date().toDateString(),
      };
    });
  }, [cursor]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, Array<{ id: string; title: string; color: string; type: 'event' | 'task' }>>();
    const push = (key: string, item: { id: string; title: string; color: string; type: 'event' | 'task' }) => {
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    };

    for (const event of data?.events ?? []) {
      push(event.startAt.slice(0, 10), { id: event.id, title: event.title, color: event.color, type: 'event' });
    }
    for (const task of data?.tasks ?? []) {
      push(task.dueDate.slice(0, 10), {
        id: task.id,
        title: task.title,
        color: task.status === 'done' ? '#b4b4b4' : '#e6e6e6',
        type: 'task',
      });
    }
    return map;
  }, [data]);

  /*
   * Meme regle que le serveur, verifiee avant l'envoi.
   *
   * Le `min` pose sur le champ de fin guide la saisie, mais un attribut HTML
   * n'empeche rien : le navigateur laisse valider une heure anterieure des
   * lors que le formulaire est soumis au clavier. Ce controle evite l'aller-
   * retour reseau ; c'est le serveur qui reste l'autorite.
   */
  const finAvantDebut = form.endTime <= form.startTime;

  async function save() {
    if (form.title.trim().length === 0) return;
    if (finAvantDebut) {
      setErreur('endAt', FIN_AVANT_DEBUT);
      return;
    }
    setSaving(true);
    // Le detail par champ renvoye par le serveur s'affiche sous le champ
    // fautif ; la saisie reste en place pour etre corrigee.
    const saved = await mutate(() => api.post('/api/events', {
        title: form.title,
        description: form.description || null,
        startAt: `${form.date}T${form.startTime}:00`,
        endAt: `${form.date}T${form.endTime}:00`,
        location: form.location || null,
        color: form.color,
        allDay: false,
      }), { notifySuccess: false });
    setSaving(false);
    if (!saved) return;

    toast.success(t('common.success'));
      setModalOpen(false);
      set('title', '');
      void refresh();
  }

  async function remove(id: string) {
    await api.delete(`/api/events/${id}`).catch(() => toast.error(t('common.error')));
    void refresh();
  }

  const monthLabel = cursor.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const weekdays = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const selectedItems = selected ? (itemsByDate.get(selected) ?? []) : [];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t('calendar.title')}
        subtitle={t('calendar.subtitle')}
        icon="calendar"
        color="#e4d9f5"
        actions={
          <>
            <div className="flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
              <button
                type="button"
                onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
                aria-label="Mois precedent"
                className="grid size-11 place-items-center rounded-lg text-[var(--text-muted)] lm-transition-ui hover:bg-[var(--surface-2)]"
              >
                <Icon name="chevronLeft" size={16} className="rtl:rotate-180" />
              </button>
              <span className="min-w-36 px-2 text-center text-[13px] font-medium capitalize text-[var(--text)]">
                {monthLabel}
              </span>
              <button
                type="button"
                onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
                aria-label="Mois suivant"
                className="grid size-11 place-items-center rounded-lg text-[var(--text-muted)] lm-transition-ui hover:bg-[var(--surface-2)]"
              >
                <Icon name="chevronRight" size={16} className="rtl:rotate-180" />
              </button>
            </div>
            <Button icon="plus" onClick={() => setModalOpen(true)}>
              {t('calendar.newEvent')}
            </Button>
          </>
        }
      />

      {loading ? (
        <Skeleton className="h-[520px] rounded-2xl" />
      ) : (
        <Card padded={false} className="overflow-hidden">
          <div className="grid grid-cols-7 border-b border-[var(--border)]">
            {weekdays.map((day, index) => (
              <div key={index} className="py-2.5 text-center text-[11px] font-medium text-[var(--text-faint)]">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {grid.map((cell) => {
              const items = itemsByDate.get(cell.key) ?? [];
              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => setSelected(cell.key === selected ? null : cell.key)}
                  className={cx(
                    'min-h-24 border-b border-e border-[var(--border)] p-1.5 text-start align-top transition-colors',
                    !cell.inMonth && 'opacity-35',
                    selected === cell.key && 'bg-[var(--surface-2)]',
                    'hover:bg-[var(--surface-2)]',
                  )}
                >
                  <span
                    className={cx(
                      'inline-grid size-6 place-items-center rounded-full text-[12px]',
                      cell.isToday ? 'lm-gradient-bg font-semibold' : 'text-[var(--text-muted)]',
                    )}
                  >
                    {cell.day}
                  </span>

                  <div className="mt-1 space-y-0.5">
                    {items.slice(0, 3).map((item) => (
                      <div
                        key={`${item.type}-${item.id}`}
                        className="truncate rounded px-1 py-0.5 text-[10px] leading-tight"
                        style={{ background: `${item.color}22`, color: item.color }}
                      >
                        {item.title}
                      </div>
                    ))}
                    {items.length > 3 && (
                      <div className="px-1 text-[10px] text-[var(--text-faint)]">+{items.length - 3}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {selected && (
        <Card className="mt-4">
          <h2 className="mb-3 text-sm font-medium capitalize text-[var(--text)]">
            {new Date(`${selected}T12:00:00Z`).toLocaleDateString(locale, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </h2>

          {selectedItems.length === 0 ? (
            <p className="py-4 text-center text-xs text-[var(--text-faint)]">{t('calendar.empty')}</p>
          ) : (
            <ul className="space-y-1.5">
              {selectedItems.map((item) => (
                <li
                  key={`${item.type}-${item.id}`}
                  className="group flex items-center gap-2.5 rounded-xl bg-[var(--surface-2)] px-3 py-2.5"
                >
                  <span className="size-2 shrink-0 rounded-full" style={{ background: item.color }} />
                  <span className="min-w-0 flex-1 truncate text-sm text-[var(--text)]">{item.title}</span>
                  <span className="shrink-0 text-[10px] uppercase text-[var(--text-faint)]">
                    {item.type === 'task' ? t('nav.tasks') : t('calendar.title')}
                  </span>
                  {item.type === 'event' && (
                    <IconButton icon="trash" label={t('common.delete')} size={13} tone="danger" onClick={() => remove(item.id)} discret />
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card className="mt-4">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#d9c7f0]/12 text-[#d9c7f0]">
            <Icon name="globe" size={17} />
          </span>
          <div>
            <p className="text-sm font-medium text-[var(--text)]">{t('calendar.sync')}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-muted)]">{t('calendar.syncHint')}</p>
          </div>
        </div>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={save}
        title={t('calendar.newEvent')}
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
          <Field label="Titre" htmlFor="event-title" error={erreurs.title} required>
            <Input id="event-title" value={form.title} onChange={(event) => set('title', event.target.value)} autoFocus />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label={t('common.date')} htmlFor="event-date">
              <Input id="event-date" type="date" value={form.date} onChange={(event) => set('date', event.target.value)} />
            </Field>
            <Field label="Debut" htmlFor="event-start" error={erreurs.startAt}>
              <Input id="event-start" type="time" value={form.startTime} onChange={(event) => set('startTime', event.target.value)} />
            </Field>
            <Field
              label="Fin"
              htmlFor="event-end"
              error={erreurs.endAt || (finAvantDebut ? FIN_AVANT_DEBUT : undefined)}
            >
              {/*
                `min` suit l'heure de debut : le selecteur natif refuse de
                proposer une fin anterieure, et l'incoherence se voit avant
                meme la soumission.
              */}
              <Input
                id="event-end"
                type="time"
                min={form.startTime}
                aria-invalid={finAvantDebut || Boolean(erreurs.endAt)}
                value={form.endTime}
                onChange={(event) => set('endTime', event.target.value)}
              />
            </Field>
          </div>

          <Field label={t('calendar.location')} htmlFor="event-location" error={erreurs.location}>
            <Input id="event-location" value={form.location} onChange={(event) => set('location', event.target.value)} />
          </Field>

          <Field label={t('common.notes')} htmlFor="event-description" error={erreurs.description}>
            <Textarea id="event-description" rows={2} value={form.description} onChange={(event) => set('description', event.target.value)} />
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
