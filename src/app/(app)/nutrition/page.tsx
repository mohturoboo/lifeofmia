'use client';

import { useState } from 'react';
import { api, useResource } from '@/lib/client/api';
import { Button, Card, CardHeader, Field, Input, Select, Skeleton, Textarea, cx } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { Modal } from '@/components/ui/modal';
import { DonutChart } from '@/components/charts';
import { useToast } from '@/components/ui/toast';
import { PageHeader, DateNav } from '@/components/page-header';
import { useI18n } from '@/i18n/provider';
import { dateKeyIn } from '@/lib/date';

interface Meal {
  id: string;
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  quantity: number;
  notes: string | null;
  aiGenerated: boolean;
  isTemplate: boolean;
}

interface NutritionData {
  date: string;
  meals: Meal[];
  templates: Meal[];
  waterMl: number;
  totals: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
}

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const WATER_GOAL_ML = 2000;
const GLASS_ML = 250;

const EMPTY_FORM = {
  type: 'breakfast' as Meal['type'],
  name: '',
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
  fiber: '',
  notes: '',
  saveAsTemplate: false,
};

export default function NutritionPage() {
  const { t, locale, n } = useI18n();
  const toast = useToast();

  const [date, setDate] = useState(() => dateKeyIn(Intl.DateTimeFormat().resolvedOptions().timeZone));
  const { data, loading, refresh, setData } = useResource<NutritionData>(`/api/meals?date=${date}`, [date]);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  /** Repas en cours de modification ; `null` signifie « creation ». */
  const [editing, setEditing] = useState<Meal | null>(null);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const typeLabels: Record<Meal['type'], string> = {
    breakfast: t('nutrition.breakfast'),
    lunch: t('nutrition.lunch'),
    dinner: t('nutrition.dinner'),
    snack: t('nutrition.snack'),
  };

  function openCreate(type: Meal['type']) {
    setEditing(null);
    setForm({ ...EMPTY_FORM, type });
    setModalOpen(true);
  }

  /**
   * Ouvre le formulaire pre-rempli. Meme fenetre que la creation : les champs
   * sont les memes, et un second formulaire aurait diverge a la premiere
   * evolution du modele.
   *
   * Les nombres sont convertis en chaines parce que le formulaire travaille sur
   * du texte — sans ca, un champ a 0 s'afficherait vide et une valeur effacee
   * repartirait a zero sans que l'utilisateur l'ait demande.
   */
  function openEdit(meal: Meal) {
    setEditing(meal);
    setForm({
      type: meal.type,
      name: meal.name,
      calories: String(meal.calories),
      protein: String(meal.protein),
      carbs: String(meal.carbs),
      fat: String(meal.fat),
      fiber: String(meal.fiber),
      notes: meal.notes ?? '',
      // La case propose d'enregistrer un modele : un modele en est deja un.
      saveAsTemplate: false,
    });
    setModalOpen(true);
  }

  /** Reprend un modele enregistre : evite de resaisir les macros a chaque fois. */
  async function applyTemplate(template: Meal) {
    await api.post('/api/meals', {
      date,
      type: template.type,
      name: template.name,
      calories: template.calories,
      protein: template.protein,
      carbs: template.carbs,
      fat: template.fat,
      fiber: template.fiber,
      notes: template.notes,
    });
    toast.success(t('common.success'));
    void refresh();
  }

  async function save() {
    if (form.name.trim().length === 0) return;
    setSaving(true);

    const payload = {
      type: form.type,
      name: form.name,
      calories: Number(form.calories) || 0,
      protein: Number(form.protein) || 0,
      carbs: Number(form.carbs) || 0,
      fat: Number(form.fat) || 0,
      fiber: Number(form.fiber) || 0,
      notes: form.notes || null,
      saveAsTemplate: form.saveAsTemplate,
    };

    try {
      // La date n'est envoyee qu'a la creation : modifier un repas ne doit pas
      // le deplacer sur la journee affichee, sinon corriger les calories d'hier
      // depuis aujourd'hui le ferait changer de jour au passage.
      if (editing) await api.patch(`/api/meals/${editing.id}`, payload);
      else await api.post('/api/meals', { date, ...payload });

      toast.success(t('common.success'));
      setModalOpen(false);
      setEditing(null);
      void refresh();
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  /** Fermer remet l'etat a plat : sans ca, rouvrir en creation garderait le repas precedent. */
  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  async function remove(meal: Meal) {
    await api.delete(`/api/meals/${meal.id}`).catch(() => toast.error(t('common.error')));
    void refresh();
  }

  /**
   * Hydratation : la jauge bouge immediatement, le reseau suit.
   *
   * Le bouton attendait la reponse du serveur puis rechargeait toute la page
   * de nutrition — deux allers-retours avant le moindre retour visuel. On
   * remplaçait donc un geste instantane par une attente, et rien n'empechait
   * l'utilisateur de cliquer cinq fois en croyant que le bouton ne marchait pas.
   *
   * La reponse porte le total recalcule cote serveur : il remplace l'estimation
   * locale des son arrivee, et l'echec restaure la valeur precedente.
   */
  async function addWater(amount: number) {
    const previous = data?.waterMl ?? 0;
    setData((current) =>
      current ? { ...current, waterMl: Math.max(0, current.waterMl + amount) } : current,
    );

    try {
      const result = await api.post<{ waterMl: number }>('/api/water', { date, amountMl: amount });
      setData((current) => (current ? { ...current, waterMl: result.waterMl } : current));
    } catch {
      setData((current) => (current ? { ...current, waterMl: previous } : current));
      toast.error(t('common.error'));
    }
  }

  if (loading || !data) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const macros = [
    { label: t('nutrition.protein'), value: data.totals.protein * 4 },
    { label: t('nutrition.carbs'), value: data.totals.carbs * 4 },
    { label: t('nutrition.fat'), value: data.totals.fat * 9 },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t('nutrition.title')}
        subtitle={t('nutrition.subtitle')}
        icon="apple"
        color="#ff9fbf"
        actions={<DateNav date={date} onChange={setDate} locale={locale} />}
      />

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={t('nutrition.macros')} icon="chart" accent="#ff9fbf" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <DonutChart
              data={macros}
              size={150}
              thickness={20}
              centerValue={n(data.totals.calories)}
              centerLabel="kcal"
            />
            <dl className="space-y-2.5 self-center">
              {[
                { label: t('nutrition.protein'), value: data.totals.protein, unit: 'g', color: '#e9b8d5' },
                { label: t('nutrition.carbs'), value: data.totals.carbs, unit: 'g', color: '#fbc7da' },
                { label: t('nutrition.fat'), value: data.totals.fat, unit: 'g', color: '#f6d9e4' },
                { label: t('nutrition.fiber'), value: data.totals.fiber, unit: 'g', color: '#ff9fbf' },
              ].map((macro) => (
                <div key={macro.label} className="flex items-center justify-between gap-4">
                  <dt className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                    <span className="size-2.5 rounded-full" style={{ background: macro.color }} />
                    {macro.label}
                  </dt>
                  <dd className="text-sm font-medium text-[var(--text)]">
                    {n(macro.value)} {macro.unit}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Card>

        <Card>
          <CardHeader title={t('nutrition.water')} icon="droplet" accent="#e6e6e6" />
          <div className="text-center">
            <p className="text-3xl font-semibold text-[var(--text)]">
              {(data.waterMl / 1000).toFixed(1)}
              <span className="ms-1 text-sm font-normal text-[var(--text-faint)]">L</span>
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-faint)]">
              {t('nutrition.waterGoal')} : {WATER_GOAL_ML / 1000} L
            </p>

            <div className="mt-4 flex justify-center gap-1.5">
              {Array.from({ length: WATER_GOAL_ML / GLASS_ML }).map((_, index) => (
                <span
                  key={index}
                  className={cx(
                    'h-8 w-3 rounded-sm transition-colors',
                    index * GLASS_ML < data.waterMl ? 'bg-[#e6e6e6]' : 'bg-[var(--surface-2)]',
                  )}
                />
              ))}
            </div>

            <div className="mt-4 flex justify-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => addWater(-GLASS_ML)} aria-label="Retirer un verre">
                <Icon name="minus" size={15} />
              </Button>
              <Button size="sm" icon="plus" onClick={() => addWater(GLASS_ML)}>
                {t('nutrition.addGlass')}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {MEAL_TYPES.map((type) => {
          const meals = data.meals.filter((meal) => meal.type === type);
          const calories = meals.reduce((sum, meal) => sum + meal.calories * meal.quantity, 0);

          return (
            <Card key={type}>
              <CardHeader
                title={typeLabels[type]}
                subtitle={`${n(Math.round(calories))} kcal`}
                icon="apple"
                accent="#ff9fbf"
                action={
                  <Button variant="ghost" size="sm" icon="plus" onClick={() => openCreate(type)} aria-label={t('nutrition.addMeal')} />
                }
              />

              {meals.length === 0 ? (
                <p className="py-5 text-center text-xs text-[var(--text-faint)]">{t('nutrition.empty')}</p>
              ) : (
                <ul className="space-y-1.5">
                  {meals.map((meal) => (
                    <li key={meal.id} className="group flex items-center gap-3 rounded-xl bg-[var(--surface-2)] px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-sm text-[var(--text)]">
                          {meal.name}
                          {meal.aiGenerated && <Icon name="sparkles" size={11} className="shrink-0 text-[var(--brand-text)]" />}
                        </p>
                        <p className="text-[11px] text-[var(--text-faint)]">
                          {Math.round(meal.calories)} kcal · P {Math.round(meal.protein)} · G {Math.round(meal.carbs)} · L{' '}
                          {Math.round(meal.fat)}
                        </p>
                      </div>
                      {/*
                        Les actions restent visibles sur petit ecran : elles
                        n'apparaissaient qu'au survol, un geste qui n'existe pas
                        sur mobile — le bouton etait donc inatteignable au doigt.
                      */}
                      <div className="flex shrink-0 items-center gap-0.5 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                        <button
                          type="button"
                          onClick={() => openEdit(meal)}
                          aria-label={`${t('common.edit')} — ${meal.name}`}
                          className="grid size-7 place-items-center rounded-lg text-[var(--text-faint)] transition-colors hover:text-[var(--text)]"
                        >
                          <Icon name="edit" size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(meal)}
                          aria-label={`${t('common.delete')} — ${meal.name}`}
                          className="grid size-7 place-items-center rounded-lg text-[var(--text-faint)] transition-colors hover:text-red-500"
                        >
                          <Icon name="trash" size={13} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>

      {data.templates.length > 0 && (
        <Card className="mt-4">
          <CardHeader title={t('nutrition.templates')} icon="note" accent="#d9c7f0" />
          <div className="flex flex-wrap gap-2">
            {/*
              Deux actions distinctes sur un meme modele : le corps l'ajoute a
              la journee, le crayon le corrige. Ce sont deux boutons frere a
              frere — un bouton imbrique dans un autre serait du HTML invalide
              et le clic interieur declencherait aussi l'exterieur.
            */}
            {data.templates.map((template) => (
              <div
                key={template.id}
                className="group flex items-center rounded-xl border border-[var(--border)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]"
              >
                <button
                  type="button"
                  onClick={() => applyTemplate(template)}
                  className="px-3 py-2 text-start"
                  aria-label={`${t('nutrition.addMeal')} — ${template.name}`}
                >
                  <span className="block text-[13px] text-[var(--text)]">{template.name}</span>
                  <span className="block text-[11px] text-[var(--text-faint)]">{Math.round(template.calories)} kcal</span>
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(template)}
                  aria-label={`${t('common.edit')} — ${template.name}`}
                  className="grid size-7 place-items-center rounded-lg me-1.5 text-[var(--text-faint)] transition-colors hover:text-[var(--text)]"
                >
                  <Icon name="edit" size={13} />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? t('nutrition.editMeal') : t('nutrition.addMeal')}
        footer={
          <>
            <Button variant="ghost" onClick={closeModal}>
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
            <Field label="Type" htmlFor="meal-type">
              <Select id="meal-type" value={form.type} onChange={(event) => set('type', event.target.value as Meal['type'])}>
                {MEAL_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {typeLabels[type]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('common.name')} htmlFor="meal-name" required>
              <Input id="meal-name" value={form.name} onChange={(event) => set('name', event.target.value)} autoFocus />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(
              [
                ['calories', t('nutrition.calories'), 'kcal'],
                ['protein', t('nutrition.protein'), 'g'],
                ['carbs', t('nutrition.carbs'), 'g'],
                ['fat', t('nutrition.fat'), 'g'],
                ['fiber', t('nutrition.fiber'), 'g'],
              ] as const
            ).map(([key, label, unit]) => (
              <Field key={key} label={`${label} (${unit})`} htmlFor={`meal-${key}`}>
                <Input
                  id={`meal-${key}`}
                  type="number"
                  min={0}
                  value={form[key]}
                  onChange={(event) => set(key, event.target.value)}
                  placeholder="0"
                />
              </Field>
            ))}
          </div>

          <Field label={t('common.notes')} htmlFor="meal-notes">
            <Textarea id="meal-notes" rows={2} value={form.notes} onChange={(event) => set('notes', event.target.value)} />
          </Field>

          {!editing?.isTemplate && (
          <label className="flex items-center gap-2.5 text-[13px] text-[var(--text-muted)]">
            <input
              type="checkbox"
              checked={form.saveAsTemplate}
              onChange={(event) => set('saveAsTemplate', event.target.checked)}
              className="size-[18px] rounded-md accent-brand-500"
            />
            {t('nutrition.saveTemplate')}
          </label>
          )}
        </div>
      </Modal>
    </div>
  );
}
