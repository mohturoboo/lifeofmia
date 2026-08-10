'use client';

import { useState } from 'react';
import { api, useResource } from '@/lib/client/api';
import { useMutate } from '@/lib/client/mutate';
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Select, Skeleton, cx } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { Modal } from '@/components/ui/modal';
import { DonutChart } from '@/components/charts';
import { PageHeader } from '@/components/page-header';
import { useI18n } from '@/i18n/provider';

interface Transaction {
  id: string;
  date: string;
  type: 'income' | 'expense';
  category: string;
  label: string;
  amount: number;
  currency: string;
  recurring: boolean;
  note: string | null;
}

interface FinanceData {
  month: string;
  transactions: Transaction[];
  summary: { income: number; expense: number; balance: number };
  byCategory: Record<string, number>;
}

const CATEGORIES = [
  'housing', 'food', 'transport', 'health', 'leisure',
  'education', 'shopping', 'subscriptions', 'savings', 'other',
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  housing: 'Logement',
  food: 'Alimentation',
  transport: 'Transport',
  health: 'Sante',
  leisure: 'Loisirs',
  education: 'Education',
  shopping: 'Achats',
  subscriptions: 'Abonnements',
  savings: 'Epargne',
  salary: 'Salaire',
  other: 'Autre',
};

export default function FinancePage() {
  const { t, locale, n } = useI18n();
  const { run: mutate, fields: erreurs, clearField } = useMutate();

  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const { data, loading, refresh } = useResource<FinanceData>(`/api/transactions?month=${month}`, [month]);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    type: 'expense' as Transaction['type'],
    label: '',
    amount: '',
    category: 'other',
    date: new Date().toISOString().slice(0, 10),
    recurring: false,
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    // Reprendre un champ efface son message d'erreur.
    clearField(String(key));
  };

  const shiftMonth = (delta: number) => {
    const [year, monthIndex] = month.split('-').map(Number);
    const next = new Date(year, monthIndex - 1 + delta, 1);
    setMonth(next.toISOString().slice(0, 7));
  };

  async function save() {
    const amount = Number(form.amount);
    if (form.label.trim().length === 0 || !Number.isFinite(amount) || amount <= 0) return;

    setSaving(true);
    const saved = await mutate(() =>
      api.post('/api/transactions', {
        date: form.date,
        type: form.type,
        category: form.category,
        label: form.label,
        amount,
        currency: 'EUR',
        recurring: form.recurring,
      }),
    );
    setSaving(false);
    if (!saved) return;

    setModalOpen(false);
    set('label', '');
    set('amount', '');
    void refresh();
  }

  async function remove(transaction: Transaction) {
    const deleted = await mutate(() => api.delete(`/api/transactions/${transaction.id}`));
    if (deleted !== null) void refresh();
  }

  const money = (value: number) =>
    n(value, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

  if (loading || !data) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const monthLabel = new Date(`${month}-01T12:00:00Z`).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t('finance.title')}
        subtitle={t('finance.subtitle')}
        icon="wallet"
        color="#fbe3ec"
        actions={
          <>
            <div className="flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="Mois precedent"
                className="grid size-8 place-items-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)]"
              >
                <Icon name="chevronLeft" size={16} className="rtl:rotate-180" />
              </button>
              <span className="min-w-32 px-2 text-center text-[13px] font-medium capitalize text-[var(--text)]">
                {monthLabel}
              </span>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="Mois suivant"
                className="grid size-8 place-items-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)]"
              >
                <Icon name="chevronRight" size={16} className="rtl:rotate-180" />
              </button>
            </div>
            <Button icon="plus" onClick={() => setModalOpen(true)}>
              {t('finance.newTransaction')}
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        {[
          { label: t('finance.income'), value: data.summary.income, color: '#fbe3ec', icon: 'arrowUp' as const },
          { label: t('finance.expense'), value: data.summary.expense, color: '#ff9fbf', icon: 'arrowDown' as const },
          { label: t('finance.balance'), value: data.summary.balance, color: data.summary.balance >= 0 ? '#e6e6e6' : '#ff9fbf', icon: 'wallet' as const },
        ].map((tile) => (
          <Card key={tile.label}>
            <span
              className="grid size-8 place-items-center rounded-lg"
              style={{ background: `${tile.color}1f`, color: tile.color }}
            >
              <Icon name={tile.icon} size={16} />
            </span>
            <p className="mt-2.5 text-xl font-semibold" style={{ color: tile.color }}>
              {money(tile.value)}
            </p>
            <p className="text-[11px] text-[var(--text-faint)]">{tile.label}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={t('finance.title')} subtitle={`${data.transactions.length} operations`} icon="wallet" accent="#fbe3ec" />

          {data.transactions.length === 0 ? (
            <EmptyState
              icon="wallet"
              title={t('finance.empty')}
              action={
                <Button icon="plus" onClick={() => setModalOpen(true)}>
                  {t('finance.newTransaction')}
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {data.transactions.map((transaction) => (
                <li key={transaction.id} className="group flex items-center gap-3 py-2.5">
                  <span
                    className={cx(
                      'grid size-8 shrink-0 place-items-center rounded-lg',
                      transaction.type === 'income' ? 'bg-[#f6d9e4]/12 text-[#f6d9e4]' : 'bg-red-500/12 text-red-500',
                    )}
                  >
                    <Icon name={transaction.type === 'income' ? 'arrowUp' : 'arrowDown'} size={14} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-[var(--text)]">{transaction.label}</p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <Badge color="#b4b4b4">{CATEGORY_LABELS[transaction.category] ?? transaction.category}</Badge>
                      <span className="text-[11px] text-[var(--text-faint)]">
                        {new Date(`${transaction.date}T12:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                      </span>
                      {transaction.recurring && <Icon name="clock" size={11} className="text-[var(--text-faint)]" />}
                    </div>
                  </div>

                  <span
                    className={cx(
                      'shrink-0 text-sm font-medium tabular-nums',
                      transaction.type === 'income' ? 'text-[#f6d9e4]' : 'text-[var(--text)]',
                    )}
                  >
                    {transaction.type === 'income' ? '+' : '−'}
                    {money(transaction.amount)}
                  </span>

                  <button
                    type="button"
                    onClick={() => remove(transaction)}
                    aria-label={t('common.delete')}
                    className="grid size-7 shrink-0 place-items-center rounded-lg text-[var(--text-faint)] opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title={t('finance.byCategory')} icon="chart" accent="#fbe3ec" />
          {Object.keys(data.byCategory).length === 0 ? (
            <p className="py-8 text-center text-xs text-[var(--text-faint)]">{t('common.empty')}</p>
          ) : (
            <DonutChart
              data={Object.entries(data.byCategory).map(([category, value]) => ({
                label: CATEGORY_LABELS[category] ?? category,
                value,
              }))}
              size={140}
              thickness={18}
            />
          )}
        </Card>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t('finance.newTransaction')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={save} loading={saving} disabled={!form.label || !form.amount}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(['expense', 'income'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => set('type', type)}
                aria-pressed={form.type === type}
                className={cx(
                  'rounded-xl border py-3 text-sm transition-colors',
                  form.type === type
                    ? type === 'income'
                      ? 'border-[#f6d9e4]/40 bg-[#f6d9e4]/8 text-[#f6d9e4]'
                      : 'border-red-500/40 bg-red-500/8 text-red-500'
                    : 'border-[var(--border)] text-[var(--text-muted)]',
                )}
              >
                {type === 'income' ? t('finance.income') : t('finance.expense')}
              </button>
            ))}
          </div>

          <Field label={t('finance.label')} htmlFor="transaction-label" error={erreurs.label} required>
            <Input id="transaction-label" value={form.label} onChange={(event) => set('label', event.target.value)} autoFocus />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={`${t('finance.amount')} (€)`} htmlFor="transaction-amount" error={erreurs.amount} required>
              <Input
                id="transaction-amount"
                type="number"
                step="0.01"
                min={0}
                value={form.amount}
                onChange={(event) => set('amount', event.target.value)}
              />
            </Field>
            <Field label={t('common.date')} htmlFor="transaction-date" error={erreurs.date}>
              <Input id="transaction-date" type="date" value={form.date} onChange={(event) => set('date', event.target.value)} />
            </Field>
          </div>

          <Field label={t('common.category')} htmlFor="transaction-category">
            <Select id="transaction-category" value={form.category} onChange={(event) => set('category', event.target.value)}>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABELS[category]}
                </option>
              ))}
              {form.type === 'income' && <option value="salary">{CATEGORY_LABELS.salary}</option>}
            </Select>
          </Field>

          <label className="flex items-center gap-2.5 text-[13px] text-[var(--text-muted)]">
            <input
              type="checkbox"
              checked={form.recurring}
              onChange={(event) => set('recurring', event.target.checked)}
              className="size-[18px] rounded-md accent-brand-500"
            />
            {t('finance.recurring')}
          </label>
        </div>
      </Modal>
    </div>
  );
}
