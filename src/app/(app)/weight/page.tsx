'use client';

import { useState } from 'react';
import { api, useResource } from '@/lib/client/api';
import { useMutate } from '@/lib/client/mutate';
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Skeleton, Textarea } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { Modal } from '@/components/ui/modal';
import { LineChart } from '@/components/charts';
import { useToast } from '@/components/ui/toast';
import { PageHeader } from '@/components/page-header';
import { useI18n } from '@/i18n/provider';
import { dateKeyIn } from '@/lib/date';

interface WeightEntry {
  id: string;
  date: string;
  weightKg: number;
  bodyFat: number | null;
  muscleKg: number | null;
  note: string | null;
}

interface WeightData {
  entries: WeightEntry[];
  latest: WeightEntry | null;
  heightCm: number | null;
  targetWeight: number | null;
  bmi: number | null;
  bmiCategory: 'underweight' | 'normal' | 'overweight' | 'obese' | null;
  forecast: { predicted: number; slopePerWeek: number } | null;
}

const BMI_COLORS = {
  underweight: '#e6e6e6',
  normal: '#fbe3ec',
  overweight: '#ff9fbf',
  obese: '#ff9fbf',
} as const;

export default function WeightPage() {
  const { t, locale } = useI18n();
  const toast = useToast();
  const { run: mutate, fields: erreurs, clearField } = useMutate();
  const { data, loading, refresh } = useResource<WeightData>('/api/weight');

  // Une mesure ne s'enregistre pas pour demain.
  const aujourdhui = dateKeyIn(Intl.DateTimeFormat().resolvedOptions().timeZone);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: dateKeyIn(Intl.DateTimeFormat().resolvedOptions().timeZone),
    weightKg: '',
    bodyFat: '',
    muscleKg: '',
    note: '',
  });

  const set = <K extends keyof typeof form>(key: K, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    // Reprendre un champ efface son message d'erreur.
    clearField(String(key));
  };

  async function save() {
    const weight = Number(form.weightKg);
    if (!Number.isFinite(weight) || weight <= 0) return;

    setSaving(true);
    // Le detail par champ renvoye par le serveur s'affiche sous le champ
    // fautif ; la saisie reste en place pour etre corrigee.
    const saved = await mutate(() => api.post('/api/weight', {
        date: form.date,
        weightKg: weight,
        bodyFat: form.bodyFat ? Number(form.bodyFat) : null,
        muscleKg: form.muscleKg ? Number(form.muscleKg) : null,
        note: form.note || null,
      }), { notifySuccess: false });
    setSaving(false);
    if (!saved) return;

    toast.success(t('common.success'));
      setModalOpen(false);
      setForm((current) => ({ ...current, weightKg: '', bodyFat: '', muscleKg: '', note: '' }));
      void refresh();
  }

  async function remove(entry: WeightEntry) {
    if (!window.confirm(t('common.deleteConfirm'))) return;
    await api.delete(`/api/weight/${entry.id}`).catch(() => toast.error(t('common.error')));
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

  const bmiLabels = {
    underweight: t('weight.bmiUnderweight'),
    normal: t('weight.bmiNormal'),
    overweight: t('weight.bmiOverweight'),
    obese: t('weight.bmiObese'),
  };

  // La projection est affichee en pointilles a la suite de la courbe reelle.
  const chartData = data.entries.map((entry) => ({
    label: new Date(`${entry.date}T12:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
    value: entry.weightKg,
  }));

  const forecastData = data.forecast
    ? [{ label: '+30 j', value: data.forecast.predicted }]
    : [];

  const first = data.entries[0];
  const totalDelta = first && data.latest ? Math.round((data.latest.weightKg - first.weightKg) * 10) / 10 : null;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t('weight.title')}
        subtitle={t('weight.subtitle')}
        icon="scale"
        color="#f6d9e4"
        actions={
          <Button icon="plus" onClick={() => setModalOpen(true)}>
            {t('weight.addEntry')}
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <p className="text-[11px] text-[var(--text-faint)]">{t('weight.current')}</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--text)]">
            {data.latest ? `${data.latest.weightKg}` : '—'}
            {data.latest && <span className="ms-1 text-sm font-normal text-[var(--text-faint)]">kg</span>}
          </p>
          {totalDelta !== null && (
            <p className={`mt-0.5 text-[11px] ${totalDelta < 0 ? 'text-[#f6d9e4]' : 'text-[#ff9fbf]'}`}>
              {totalDelta > 0 ? '+' : ''}
              {totalDelta} kg depuis le debut
            </p>
          )}
        </Card>

        <Card>
          <p className="text-[11px] text-[var(--text-faint)]">{t('weight.bmi')}</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--text)]">{data.bmi ?? '—'}</p>
          {data.bmiCategory && (
            <div className="mt-1">
              <Badge color={BMI_COLORS[data.bmiCategory]}>{bmiLabels[data.bmiCategory]}</Badge>
            </div>
          )}
          {!data.heightCm && (
            <p className="mt-0.5 text-[11px] text-[var(--text-faint)]">{t('weight.heightHint')}</p>
          )}
        </Card>

        <Card>
          <p className="text-[11px] text-[var(--text-faint)]">{t('weight.target')}</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--text)]">
            {data.targetWeight ?? '—'}
            {data.targetWeight && <span className="ms-1 text-sm font-normal text-[var(--text-faint)]">kg</span>}
          </p>
          {data.targetWeight && data.latest && (
            <p className="mt-0.5 text-[11px] text-[var(--text-faint)]">
              {Math.abs(Math.round((data.latest.weightKg - data.targetWeight) * 10) / 10)} kg restants
            </p>
          )}
        </Card>

        <Card>
          <p className="text-[11px] text-[var(--text-faint)]">{t('weight.forecast')}</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--text)]">
            {data.forecast ? `${data.forecast.predicted}` : '—'}
            {data.forecast && <span className="ms-1 text-sm font-normal text-[var(--text-faint)]">kg</span>}
          </p>
          {data.forecast && (
            <p className="mt-0.5 text-[11px] text-[var(--text-faint)]">
              {data.forecast.slopePerWeek > 0 ? '+' : ''}
              {data.forecast.slopePerWeek} kg {t('weight.perWeek')}
            </p>
          )}
        </Card>
      </div>

      <Card className="mb-4">
        <CardHeader
          title={t('weight.evolution')}
          subtitle={data.forecast ? t('weight.forecastHint') : undefined}
          icon="trending"
          accent="#f6d9e4"
        />
        {data.entries.length < 2 ? (
          <EmptyState icon="scale" title={t('weight.empty')} hint={t('common.emptyHint')} />
        ) : (
          <LineChart data={chartData} forecast={forecastData} color="#f6d9e4" unit=" kg" height={230} />
        )}
      </Card>

      <Card>
        <CardHeader title={t('weight.history')} icon="clock" accent="#f6d9e4" />
        {data.entries.length === 0 ? (
          <EmptyState icon="scale" title={t('weight.empty')} />
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {[...data.entries].reverse().map((entry, index, list) => {
              const previous = list[index + 1];
              const delta = previous ? Math.round((entry.weightKg - previous.weightKg) * 10) / 10 : null;

              return (
                <li key={entry.id} className="group flex items-center gap-3 py-2.5">
                  <span className="w-24 shrink-0 text-xs text-[var(--text-faint)]">
                    {new Date(`${entry.date}T12:00:00Z`).toLocaleDateString(locale, { day: '2-digit', month: 'short' })}
                  </span>
                  <span className="text-sm font-medium text-[var(--text)]">{entry.weightKg} kg</span>

                  {delta !== null && delta !== 0 && (
                    <span className={`flex items-center gap-0.5 text-[11px] ${delta < 0 ? 'text-[#f6d9e4]' : 'text-[#ff9fbf]'}`}>
                      <Icon name={delta < 0 ? 'arrowDown' : 'arrowUp'} size={11} />
                      {Math.abs(delta)}
                    </span>
                  )}

                  {entry.bodyFat && <span className="text-[11px] text-[var(--text-faint)]">{entry.bodyFat}% MG</span>}
                  <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--text-faint)]">{entry.note}</span>

                  <button
                    type="button"
                    onClick={() => remove(entry)}
                    aria-label={t('common.delete')}
                    className="grid size-7 shrink-0 place-items-center rounded-lg text-[var(--text-faint)] transition-opacity sm:opacity-0 hover:text-red-500 sm:group-hover:opacity-100"
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={save}
        title={t('weight.addEntry')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" onClick={save} loading={saving} disabled={!form.weightKg}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('common.date')} htmlFor="weight-date" error={erreurs.date}>
              <Input id="weight-date" max={aujourdhui} type="date" value={form.date} onChange={(event) => set('date', event.target.value)} />
            </Field>
            <Field label={`${t('weight.current')} (kg)`} htmlFor="weight-kg" error={erreurs.weightKg} required>
              <Input
                id="weight-kg"
                type="number"
                step="0.1"
                min={20}
                max={400}
                value={form.weightKg}
                onChange={(event) => set('weightKg', event.target.value)}
                autoFocus
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={`${t('weight.bodyFat')} (%)`} htmlFor="weight-fat" error={erreurs.bodyFat} hint={t('common.optional')}>
              <Input id="weight-fat" type="number" step="0.1" value={form.bodyFat} onChange={(event) => set('bodyFat', event.target.value)} />
            </Field>
            <Field label={`${t('weight.muscle')} (kg)`} htmlFor="weight-muscle" error={erreurs.muscleKg} hint={t('common.optional')}>
              <Input id="weight-muscle" type="number" step="0.1" value={form.muscleKg} onChange={(event) => set('muscleKg', event.target.value)} />
            </Field>
          </div>

          <Field label={t('common.notes')} htmlFor="weight-note" error={erreurs.note}>
            <Textarea id="weight-note" rows={2} value={form.note} onChange={(event) => set('note', event.target.value)} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
