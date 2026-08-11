'use client';

import { useState } from 'react';
import { useResource } from '@/lib/client/api';
import { Card, CardHeader, Skeleton, cx } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { LineChart, RadarChart } from '@/components/charts';
import { PageHeader } from '@/components/page-header';
import { useI18n } from '@/i18n/provider';
import type { Aggregate, DayStats } from '@/lib/stats';
import type { MetricDelta, RadarAxis } from '@/lib/analytics';

interface CompareData {
  period: string;
  days: number;
  /** Premier jour d'existence du compte, dans le fuseau de l'utilisateur. */
  accountStart: string;
  /** `false` tant que la periode de reference n'est pas entierement vecue. */
  hasPrevious: boolean;
  current: { from: string; to: string; totals: Aggregate; series: DayStats[] };
  previous: { from: string; to: string; totals: Aggregate; series: DayStats[] } | null;
  metrics: MetricDelta[];
  radar: { current: RadarAxis[]; previous: RadarAxis[] | null };
}

const PERIODS = ['7d', '30d', '3m', '6m', '1y', 'all'] as const;

export default function ComparePage() {
  const { t, locale, n } = useI18n();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>('30d');
  const { data, loading } = useResource<CompareData>(`/api/compare?period=${period}`, [period]);

  const periodLabels: Record<string, string> = {
    '7d': t('compare.since7d'),
    '30d': t('compare.since30d'),
    '3m': t('compare.since3m'),
    '6m': t('compare.since6m'),
    '1y': t('compare.since1y'),
    all: t('compare.sinceStart'),
  };

  if (loading || !data) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  /*
   * Annee sur quatre chiffres : « 12 juin 26 » se lit comme un jour de juin
   * 26, pas comme l'annee 2026. L'ambiguite est gratuite sur une page dont
   * tout le propos est de situer deux periodes l'une par rapport a l'autre.
   */
  const formatDate = (key: string) =>
    new Date(`${key}T12:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={t('compare.title')}
        subtitle={t('compare.subtitle')}
        icon="compare"
        color="#d9c7f0"
        actions={
          <div className="flex flex-wrap gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
            {PERIODS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setPeriod(value)}
                aria-pressed={period === value}
                className={cx(
                  'rounded-lg px-3 py-1.5 text-[13px] transition-colors',
                  period === value
                    ? 'bg-[var(--surface-2)] font-medium text-[var(--text)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]',
                )}
              >
                {periodLabels[value]}
              </button>
            ))}
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="border-[var(--border)]">
          <p className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">{t('compare.periodA')}</p>
          {data.previous ? (
            <>
              <p className="mt-1 text-sm font-medium text-[var(--text-muted)]">
                {formatDate(data.previous.from)} → {formatDate(data.previous.to)}
              </p>
              <p className="mt-3 text-3xl font-semibold text-[var(--text-muted)]">
                {data.previous.totals.avgDiscipline}%
              </p>
              <p className="text-[11px] text-[var(--text-faint)]">{t('dash.disciplineScore')}</p>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm font-medium text-[var(--text-muted)]">—</p>
              <p className="mt-3 text-[13px] leading-relaxed text-[var(--text-faint)]">
                {t('compare.noReference')}
              </p>
              <p className="mt-1.5 text-[11px] text-[var(--text-faint)]">
                {t('compare.accountCreated')} {formatDate(data.accountStart)}
              </p>
            </>
          )}
        </Card>

        <Card className="border-brand-500/30 bg-brand-500/[0.04]">
          <p className="text-[11px] uppercase tracking-wide text-[var(--brand-text)]">{t('compare.periodB')}</p>
          <p className="mt-1 text-sm font-medium text-[var(--text)]">
            {formatDate(data.current.from)} → {formatDate(data.current.to)}
          </p>
          <p className="mt-3 text-3xl font-semibold lm-gradient-text">{data.current.totals.avgDiscipline}%</p>
          <p className="text-[11px] text-[var(--text-faint)]">{t('dash.disciplineScore')}</p>
        </Card>
      </div>

      <Card className="mb-4">
        <CardHeader title={t('compare.metric')} subtitle="Periode courante face a la precedente" icon="chart" accent="#d9c7f0" />

        {/*
          Sans periode de reference, le tableau ne peut afficher que des ecarts
          calcules contre des zeros — c'est-a-dire des ecarts faux. On explique
          l'attente plutot que de remplir la colonne Δ.
        */}
        {!data.previous ? (
          <p className="py-10 text-center text-[13px] leading-relaxed text-[var(--text-faint)]">
            {t('compare.noReference')}
          </p>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <caption className="lm-sr-only">
              Comparaison des indicateurs entre la periode courante et la precedente
            </caption>
            <thead>
              <tr className="border-b border-[var(--border)] text-start text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
                <th scope="col" className="py-2 text-start font-medium">{t('compare.metric')}</th>
                <th scope="col" className="py-2 text-end font-medium">{t('compare.periodA')}</th>
                <th scope="col" className="py-2 text-end font-medium">{t('compare.periodB')}</th>
                <th scope="col" className="py-2 text-end font-medium">Δ</th>
              </tr>
            </thead>
            <tbody>
              {data.metrics.map((metric) => {
                // Une hausse est « bonne » sauf pour les indicateurs ou l'inverse
                // est vrai (le poids, dont la direction souhaitee depend de l'objectif).
                const improved = metric.lowerIsBetter ? metric.delta < 0 : metric.delta > 0;
                const neutral = metric.delta === 0;
                const color = neutral ? 'var(--text-faint)' : improved ? '#fbe3ec' : '#ff9fbf';

                return (
                  <tr key={metric.key} className="border-b border-[var(--border)] last:border-0">
                    <th scope="row" className="py-2.5 text-start font-normal text-[var(--text-muted)]">
                      {t(metric.labelKey)}
                    </th>
                    <td className="py-2.5 text-end tabular-nums text-[var(--text-faint)]">
                      {n(metric.previous)} {metric.unit}
                    </td>
                    <td className="py-2.5 text-end font-medium tabular-nums text-[var(--text)]">
                      {n(metric.current)} {metric.unit}
                    </td>
                    <td className="py-2.5 text-end">
                      <span className="inline-flex items-center gap-1 tabular-nums" style={{ color }}>
                        {!neutral && <Icon name={metric.delta > 0 ? 'arrowUp' : 'arrowDown'} size={12} />}
                        {neutral ? '—' : `${metric.delta > 0 ? '+' : ''}${n(metric.delta)}`}
                        {metric.percent !== null && !neutral && (
                          <span className="text-[11px] opacity-70">({metric.percent > 0 ? '+' : ''}{metric.percent}%)</span>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={t('dash.disciplineScore')} subtitle={periodLabels[period]} icon="trending" accent="#fbc7da" />
          <LineChart
            data={data.current.series.map((day) => ({
              label: new Date(`${day.date}T12:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
              value: day.disciplineScore,
            }))}
            color="#fbc7da"
            unit="%"
            height={230}
            domain={[0, 100]}
          />
        </Card>

        <Card>
          <CardHeader
            title={t('stats.radar')}
            subtitle={data.radar.previous ? "Plein : aujourd'hui · pointilles : avant" : "Periode courante"}
            icon="compare"
            accent="#d9c7f0"
          />
          <RadarChart
            data={data.radar.current.map((axis) => ({ label: t(axis.labelKey), value: axis.value }))}
            compareData={data.radar.previous?.map((axis) => ({ label: t(axis.labelKey), value: axis.value }))}
            size={240}
            color="#d9c7f0"
            compareColor="#b4b4b4"
          />
        </Card>
      </div>
    </div>
  );
}
