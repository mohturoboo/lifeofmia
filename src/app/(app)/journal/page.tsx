'use client';

import { useEffect, useState } from 'react';
import { api, useResource } from '@/lib/client/api';
import { Button, Card, CardHeader, Field, Input, Skeleton, Textarea, cx } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { PageHeader, DateNav } from '@/components/page-header';
import { useI18n } from '@/i18n/provider';
import { dateKeyIn } from '@/lib/date';

interface JournalEntry {
  id: string;
  date: string;
  mood: number;
  energy: number;
  title: string | null;
  content: string;
  gratitude: string | null;
  tags: string[];
  aiSummary: string | null;
}

interface DayResponse {
  date: string;
  entry: JournalEntry | null;
}

const MOOD_EMOJIS = ['😞', '😕', '😐', '🙂', '😄'];

export default function JournalPage() {
  const { t, locale } = useI18n();
  const toast = useToast();

  const [date, setDate] = useState(() => dateKeyIn(Intl.DateTimeFormat().resolvedOptions().timeZone));
  const { data, loading, refresh } = useResource<DayResponse>(`/api/journal?date=${date}`, [date]);

  const [form, setForm] = useState({ mood: 3, energy: 3, title: '', content: '', gratitude: '' });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Le formulaire se recharge a chaque changement de date, sans ecraser une
  // saisie en cours (d'ou le drapeau `dirty`).
  useEffect(() => {
    if (!data) return;
    setForm({
      mood: data.entry?.mood ?? 3,
      energy: data.entry?.energy ?? 3,
      title: data.entry?.title ?? '',
      content: data.entry?.content ?? '',
      gratitude: data.entry?.gratitude ?? '',
    });
    setDirty(false);
  }, [data]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
  };

  async function save() {
    setSaving(true);
    try {
      await api.put('/api/journal', {
        date,
        mood: form.mood,
        energy: form.energy,
        title: form.title || null,
        content: form.content,
        gratitude: form.gratitude || null,
        tags: [],
        media: [],
      });
      toast.success(t('common.success'));
      setDirty(false);
      void refresh();
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  const moodLabels = [
    t('journal.moodVeryBad'),
    t('journal.moodBad'),
    t('journal.moodNeutral'),
    t('journal.moodGood'),
    t('journal.moodVeryGood'),
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t('journal.title')}
        subtitle={t('journal.subtitle')}
        icon="book"
        color="#efc4e2"
        actions={
          <>
            <DateNav date={date} onChange={setDate} locale={locale} />
            <Button onClick={save} loading={saving} disabled={!dirty}>
              {t('common.save')}
            </Button>
          </>
        }
      />

      {loading ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader title={t('journal.mood')} icon="sparkles" accent="#efc4e2" />
            <div className="flex justify-between gap-2">
              {MOOD_EMOJIS.map((emoji, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => set('mood', index + 1)}
                  aria-pressed={form.mood === index + 1}
                  aria-label={moodLabels[index]}
                  className={cx(
                    'flex flex-1 flex-col items-center gap-1.5 rounded-xl border py-3 transition-all',
                    form.mood === index + 1
                      ? 'border-[#efc4e2]/40 bg-[#efc4e2]/10'
                      : 'border-[var(--border)] hover:border-[var(--border-strong)]',
                  )}
                >
                  <span className="text-2xl" aria-hidden="true">
                    {emoji}
                  </span>
                  <span className="hidden text-[10px] text-[var(--text-faint)] sm:block">{moodLabels[index]}</span>
                </button>
              ))}
            </div>

            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-[13px]">
                <span className="text-[var(--text-muted)]">{t('journal.energy')}</span>
                <span className="font-medium text-[var(--text)]">{form.energy}/5</span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                value={form.energy}
                onChange={(event) => set('energy', Number(event.target.value))}
                aria-label={t('journal.energy')}
                className="w-full accent-[#efc4e2]"
              />
            </div>
          </Card>

          <Card>
            <Field label="Titre" htmlFor="journal-title" className="mb-4">
              <Input
                id="journal-title"
                value={form.title}
                onChange={(event) => set('title', event.target.value)}
                placeholder="Une phrase qui resume la journee"
              />
            </Field>

            <Field label={t('journal.thoughts')} htmlFor="journal-content">
              <Textarea
                id="journal-content"
                rows={12}
                value={form.content}
                onChange={(event) => set('content', event.target.value)}
                placeholder={t('journal.writePlaceholder')}
                className="leading-relaxed"
              />
            </Field>
          </Card>

          <Card>
            <CardHeader title={t('journal.gratitude')} subtitle={t('journal.gratitudeHint')} icon="sparkles" accent="#ff9fbf" />
            <Textarea
              rows={3}
              value={form.gratitude}
              onChange={(event) => set('gratitude', event.target.value)}
              aria-label={t('journal.gratitude')}
            />
          </Card>

          {data?.entry?.aiSummary && (
            <Card>
              <CardHeader title={t('journal.aiSummary')} icon="sparkles" accent="#fbc7da" />
              <p className="text-sm leading-relaxed text-[var(--text-muted)]">{data.entry.aiSummary}</p>
            </Card>
          )}

          {dirty && (
            <div className="sticky bottom-24 flex justify-center lg:bottom-6">
              <Button onClick={save} loading={saving} icon="check" size="lg">
                {t('common.save')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
