'use client';

import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/ui/primitives';

/**
 * Bibliotheque de graphiques.
 *
 * Ecrits en SVG pur plutot qu'avec une librairie tierce : aucun kilo-octet de
 * dependance, un rendu serveur immediat, une maitrise totale du style (les
 * couleurs suivent les variables du theme) et une accessibilite explicite
 * (`role="img"` + description textuelle).
 *
 * Tous les composants sont responsives via `viewBox` + `preserveAspectRatio`.
 */

export interface Point {
  label: string;
  value: number;
  /**
   * Position sur l'axe horizontal, quand elle n'est pas simplement le rang.
   *
   * Une serie de mesures n'est pas forcement reguliere : trois pesees les 8, 10
   * et 31 decembre etaient dessinees a intervalles egaux, ce qui donnait a
   * trois semaines d'ecart la meme largeur qu'a deux jours. La pente affichee
   * ne correspondait a aucune realite. Renseignee sur TOUS les points d'une
   * serie, cette valeur — un horodatage, par exemple — espace le trace
   * proportionnellement au temps ecoule.
   */
  at?: number;
}

const PALETTE = ['#e9b8d5', '#fbc7da', '#f6d9e4', '#ff9fbf', '#d9c7f0', '#e6e6e6', '#efc4e2', '#dcc7ea'];

/** Coordonnees polaires -> cartesiennes, utilisees par le radar et le donut. */
function polar(cx0: number, cy0: number, radius: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx0 + radius * Math.cos(rad), y: cy0 + radius * Math.sin(rad) };
}

/** Interpolation de Catmull-Rom convertie en courbes de Bezier (trace lisse). */
function smoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  if (points.length < 3) return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  let path = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return path;
}

// --- Courbe ------------------------------------------------------------------

export interface LineChartProps {
  data: Point[];
  color?: string;
  height?: number;
  unit?: string;
  showArea?: boolean;
  /** Serie secondaire en pointilles, ex. la projection de poids. */
  forecast?: Point[];
  ariaLabel?: string;
  /**
   * Bornes imposees de l'axe vertical, ex. `[0, 100]` pour un pourcentage.
   *
   * Sans elles, l'echelle est deduite des valeurs avec une marge de 15 %, ce
   * qui a du sens pour un poids mais produit des graduations absurdes sur une
   * grandeur bornee : un score de discipline entre 0 et 27 % affichait un axe
   * allant de -4,1 a 31,1. Un score negatif n'existe pas, et l'amplitude
   * artificiellement etiree faisait passer une variation minime pour une
   * montagne.
   */
  domain?: [number, number];
}

export function LineChart({
  data,
  color = '#e9b8d5',
  height = 200,
  unit = '',
  showArea = true,
  forecast = [],
  ariaLabel,
  domain,
}: LineChartProps) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  const width = 640;
  const padding = { top: 16, right: 12, bottom: 26, left: 38 };

  // `series` est memoise avec `data` et `forecast` : le concatener directement
  // dans le corps du composant recreerait un tableau a chaque rendu et
  // annulerait l'interet du useMemo qui suit.
  const series = useMemo(() => [...data, ...forecast], [data, forecast]);

  const { min, max } = useMemo(() => {
    if (domain) return { min: domain[0], max: domain[1] };

    const values = series.map((point) => point.value).filter(Number.isFinite);
    if (values.length === 0) return { min: 0, max: 1 };
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const margin = (hi - lo) * 0.15 || Math.max(1, hi * 0.1);
    /*
     * La marge basse ne franchit pas zero quand la serie est entierement
     * positive : elle inventait sinon des graduations negatives sous une
     * courbe qui ne descend jamais en dessous de zero.
     */
    return { min: lo >= 0 ? Math.max(0, lo - margin) : lo - margin, max: hi + margin };
  }, [series, domain]);

  if (data.length === 0) {
    return (
      <div className="grid h-40 place-items-center text-xs text-[var(--text-faint)]">
        Pas encore assez de donnees
      </div>
    );
  }

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const scaleY = (value: number) =>
    padding.top + innerHeight - ((value - min) / Math.max(0.0001, max - min)) * innerHeight;

  /*
   * Abscisses : proportionnelles au temps si la serie le permet, au rang sinon.
   *
   * Le trace etait categoriel — un pas constant par point, quel que soit
   * l'intervalle reel entre deux mesures. Sur une serie de pesees espacees de
   * deux jours puis de trois semaines, la courbe montrait deux segments de
   * meme largeur : la vitesse de variation etait purement inventee par le
   * graphique. Des que chaque point porte un `at`, l'echelle horizontale
   * devient celle du temps.
   */
  const horodatages = series.map((point) => point.at);
  const proportionnel =
    series.length > 1 &&
    horodatages.every((value): value is number => typeof value === 'number' && Number.isFinite(value)) &&
    Math.max(...(horodatages as number[])) > Math.min(...(horodatages as number[]));

  const ratioAt = (index: number): number => {
    if (proportionnel) {
      const valeurs = horodatages as number[];
      const lo = Math.min(...valeurs);
      const hi = Math.max(...valeurs);
      return (valeurs[index] - lo) / (hi - lo);
    }
    return series.length > 1 ? index / (series.length - 1) : 0;
  };

  const xs = series.map((_, index) => padding.left + ratioAt(index) * innerWidth);
  const scaleX = (index: number) => xs[index] ?? padding.left;

  const mainPoints = data.map((point, index) => ({ x: scaleX(index), y: scaleY(point.value) }));
  const forecastPoints = forecast.map((point, index) => ({
    x: scaleX(data.length + index),
    y: scaleY(point.value),
  }));

  /** Bornes de la zone sensible d'un point : a mi-chemin de ses voisins. */
  const zoneAutour = (index: number) => {
    const gauche = index === 0 ? padding.left : (xs[index - 1] + xs[index]) / 2;
    const droite =
      index === series.length - 1 ? width - padding.right : (xs[index] + xs[index + 1]) / 2;
    return { x: gauche, width: Math.max(1, droite - gauche) };
  };

  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  const labelEvery = Math.max(1, Math.ceil(data.length / 7));

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height }}
        preserveAspectRatio="none"
        role="img"
        aria-label={ariaLabel ?? `Evolution de ${data.length} points, de ${data[0]?.label} a ${data[data.length - 1]?.label}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridLines.map((ratio) => {
          const y = padding.top + innerHeight * ratio;
          const value = max - (max - min) * ratio;
          return (
            <g key={ratio}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="var(--border)"
                strokeWidth="1"
                strokeDasharray="3 5"
              />
              <text x={padding.left - 7} y={y + 3.5} textAnchor="end" fontSize="10" fill="var(--text-faint)">
                {Math.round(value * 10) / 10}
              </text>
            </g>
          );
        })}

        {showArea && (
          <path
            d={`${smoothPath(mainPoints)} L${mainPoints[mainPoints.length - 1].x},${padding.top + innerHeight} L${mainPoints[0].x},${padding.top + innerHeight} Z`}
            fill={`url(#${gradientId})`}
          />
        )}

        <path d={smoothPath(mainPoints)} fill="none" stroke={color} strokeWidth="2.25" strokeLinecap="round" />

        {forecastPoints.length > 0 && (
          <path
            d={smoothPath([mainPoints[mainPoints.length - 1], ...forecastPoints])}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeDasharray="5 5"
            opacity="0.55"
          />
        )}

        {mainPoints.map((point, index) => (
          <g key={index}>
            {(hover === index || data.length <= 14) && (
              <circle cx={point.x} cy={point.y} r={hover === index ? 4.5 : 2.75} fill={color} stroke="var(--surface)" strokeWidth="1.5" />
            )}
            {/* Zone de survol large : le pointage reste facile sur mobile. */}
            <rect
              x={zoneAutour(index).x}
              y={padding.top}
              width={zoneAutour(index).width}
              height={innerHeight}
              fill="transparent"
              onMouseEnter={() => setHover(index)}
              onMouseLeave={() => setHover(null)}
            />
          </g>
        ))}

        {data.map((point, index) =>
          index % labelEvery === 0 || index === data.length - 1 ? (
            <text
              key={point.label + index}
              x={scaleX(index)}
              y={height - 7}
              textAnchor="middle"
              fontSize="10"
              fill="var(--text-faint)"
            >
              {point.label}
            </text>
          ) : null,
        )}
      </svg>

      {hover !== null && data[hover] && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs shadow-lg"
          style={{
            left: `${(scaleX(hover) / width) * 100}%`,
            top: `${(scaleY(data[hover].value) / height) * 100}%`,
          }}
        >
          <span className="font-semibold text-[var(--text)]">
            {data[hover].value}
            {unit}
          </span>
          <span className="ms-1.5 text-[var(--text-faint)]">{data[hover].label}</span>
        </div>
      )}
    </div>
  );
}

// --- Histogramme -------------------------------------------------------------

export function BarChart({
  data,
  color = '#e9b8d5',
  height = 180,
  unit = '',
  maxValue,
  emptyLabel = 'Aucune donnee sur cette periode',
}: {
  data: Point[];
  color?: string;
  height?: number;
  unit?: string;
  maxValue?: number;
  /** Texte affiche quand toutes les valeurs de la serie sont nulles. */
  emptyLabel?: string;
}) {
  const max = maxValue ?? Math.max(1, ...data.map((point) => point.value));

  if (data.length === 0) {
    return <div className="grid h-32 place-items-center text-xs text-[var(--text-faint)]">—</div>;
  }

  /*
   * Serie entierement nulle : etat vide explicite.
   *
   * Un histogramme de barres au minimum syndical se lit comme un graphique en
   * panne, pas comme « rien a montrer ». La phrase leve l'ambiguite.
   */
  if (data.every((point) => point.value <= 0)) {
    return (
      <div
        className="grid place-items-center px-4 text-center text-xs text-[var(--text-faint)]"
        style={{ height }}
      >
        {emptyLabel}
      </div>
    );
  }

  /*
   * La marge laterale reserve la place des infobulles. Elles sont larges — 3 px sur trente jours affiches en
   * 320 px — et debordent donc sur les cotes. Sans cette reserve, celle de la
   * derniere barre poussait la PAGE entiere : defilement horizontal.
   *
   * `items-stretch` (par defaut) et non `items-end` : avec `items-end`, les
   * colonnes n'etaient PAS etirees a la hauteur du graphique — elles prenaient
   * la hauteur de leur contenu, soit celle du seul libelle. La zone de barre,
   * en `flex-1` sur une base nulle, mesurait alors 0 px, et la hauteur des
   * barres, exprimee en POURCENTAGE de cette zone, valait 0 px elle aussi.
   * Le graphique restait vide quelles que soient les valeurs. L'alignement en
   * bas des barres est assure a l'interieur de chaque colonne, par le
   * `items-end` de la zone de barre.
   */
  return (
    <div
      className="flex w-full gap-1.5 px-4"
      style={{ height }}
      role="img"
      aria-label={`Histogramme de ${data.length} valeurs`}
    >
      {data.map((point, index) => {
        const ratio = Math.max(0, Math.min(1, point.value / max));
        return (
          <div key={point.label + index} className="group flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <div className="relative flex w-full min-h-0 flex-1 items-end">
              {/*
                Plancher de 3 % : une journee a zero garde un socle visible.
                Sans lui, la colonne disparaissait completement et ne se
                distinguait plus d'un jour absent de la serie.
              */}
              <div
                className="w-full rounded-t-md transition-all duration-500 ease-out group-hover:brightness-125"
                style={{
                  height: `${Math.max(3, ratio * 100)}%`,
                  background: `linear-gradient(180deg, ${color}, ${color}66)`,
                }}
              />
              {/*
                `whitespace-nowrap` : l'infobulle est aussi large que sa barre,
                soit environ 5 px sur trente jours affiches en 390 px. Sans
                cette regle, « 420 kcal » se repliait en quatre lignes d'un
                caractere, illisibles. Elle deborde desormais sur les cotes,
                ce qui est le comportement attendu d'une infobulle.
              */}
              <span className="pointer-events-none absolute inset-x-0 -top-5 whitespace-nowrap text-center text-[10px] font-medium text-[var(--text)] opacity-0 transition-opacity group-hover:opacity-100">
                {Math.round(point.value)}
                {unit}
              </span>
            </div>
            <span className="max-w-full truncate text-[10px] text-[var(--text-faint)]">{point.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// --- Anneau ------------------------------------------------------------------

export function DonutChart({
  data,
  size = 180,
  thickness = 22,
  centerLabel,
  centerValue,
}: {
  data: Point[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = data.reduce((sum, point) => sum + point.value, 0);
  const radius = (size - thickness) / 2;
  const center = size / 2;
  let angle = 0;

  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Repartition en anneau">
        <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--surface-2)" strokeWidth={thickness} />
        {total > 0 &&
          data.map((point, index) => {
            const sweep = (point.value / total) * 360;
            if (sweep <= 0) return null;
            const start = polar(center, center, radius, angle);
            const end = polar(center, center, radius, angle + sweep);
            const largeArc = sweep > 180 ? 1 : 0;
            angle += sweep;
            return (
              <path
                key={point.label}
                d={`M${start.x},${start.y} A${radius},${radius} 0 ${largeArc} 1 ${end.x},${end.y}`}
                fill="none"
                stroke={PALETTE[index % PALETTE.length]}
                strokeWidth={thickness}
                strokeLinecap="butt"
              />
            );
          })}
        {(centerValue || centerLabel) && (
          <>
            <text x={center} y={center - 2} textAnchor="middle" fontSize="22" fontWeight="600" fill="var(--text)">
              {centerValue}
            </text>
            <text x={center} y={center + 16} textAnchor="middle" fontSize="10" fill="var(--text-faint)">
              {centerLabel}
            </text>
          </>
        )}
      </svg>

      <ul className="space-y-1.5">
        {data.map((point, index) => (
          <li key={point.label} className="flex items-center gap-2 text-xs">
            <span className="size-2.5 rounded-full" style={{ background: PALETTE[index % PALETTE.length] }} />
            <span className="text-[var(--text-muted)]">{point.label}</span>
            <span className="font-medium text-[var(--text)]">
              {total > 0 ? Math.round((point.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// --- Radar -------------------------------------------------------------------

export function RadarChart({
  data,
  size = 260,
  color = '#d9c7f0',
  compareData,
  compareColor = '#fbc7da',
}: {
  data: Point[]; // valeurs 0-100
  size?: number;
  color?: string;
  compareData?: Point[];
  compareColor?: string;
}) {
  const center = size / 2;
  const radius = center - 34;
  const count = Math.max(3, data.length);

  /*
   * Les libelles des axes sont ecrits a l'exterieur du polygone : sans marge
   * horizontale, ceux de gauche et de droite (« Spiritualite », « Habitudes »)
   * sortent du viewBox et se retrouvent tronques. On elargit donc la zone de
   * dessin sur les cotes sans toucher au trace lui-meme.
   */
  const padX = 52;
  const viewWidth = size + padX * 2;

  const toPolygon = (series: Point[]) =>
    series
      .map((point, index) => {
        const value = Math.max(0, Math.min(100, point.value)) / 100;
        const { x, y } = polar(center, center, radius * value, (index * 360) / count);
        return `${x},${y}`;
      })
      .join(' ');

  return (
    <svg
      viewBox={`${-padX} 0 ${viewWidth} ${size}`}
      width={viewWidth}
      height={size}
      className="mx-auto h-auto max-w-full"
      role="img"
      aria-label="Diagramme radar d'equilibre de vie"
    >
      {[0.25, 0.5, 0.75, 1].map((ratio) => (
        <polygon
          key={ratio}
          points={Array.from({ length: count }, (_, index) => {
            const { x, y } = polar(center, center, radius * ratio, (index * 360) / count);
            return `${x},${y}`;
          }).join(' ')}
          fill="none"
          stroke="var(--border)"
          strokeWidth="1"
        />
      ))}

      {data.map((_, index) => {
        const { x, y } = polar(center, center, radius, (index * 360) / count);
        return <line key={index} x1={center} y1={center} x2={x} y2={y} stroke="var(--border)" strokeWidth="1" />;
      })}

      {compareData && compareData.length === data.length && (
        <polygon points={toPolygon(compareData)} fill={`${compareColor}22`} stroke={compareColor} strokeWidth="1.75" strokeDasharray="4 4" />
      )}

      <polygon points={toPolygon(data)} fill={`${color}33`} stroke={color} strokeWidth="2" />

      {data.map((point, index) => {
        const { x, y } = polar(center, center, radius + 16, (index * 360) / count);
        return (
          <text
            key={point.label}
            x={x}
            y={y + 3}
            textAnchor={x < center - 4 ? 'end' : x > center + 4 ? 'start' : 'middle'}
            fontSize="10"
            fill="var(--text-muted)"
          >
            {point.label}
          </text>
        );
      })}
    </svg>
  );
}

// --- Heatmap annuelle --------------------------------------------------------

export function Heatmap({
  data,
  color = '#fbc7da',
  weekdayLabels = ['L', '', 'M', '', 'V', '', 'D'],
}: {
  data: Array<{ date: string; value: number }>;
  color?: string;
  weekdayLabels?: string[];
}) {
  // Chaque colonne represente une semaine (7 cases verticales).
  const weeks = useMemo(() => {
    const columns: Array<Array<{ date: string; value: number } | null>> = [];
    let current: Array<{ date: string; value: number } | null> = [];

    data.forEach((day, index) => {
      if (index === 0) {
        // Aligne le premier jour sur sa position dans la semaine ISO.
        const weekday = (new Date(`${day.date}T12:00:00Z`).getUTCDay() + 6) % 7;
        current = Array(weekday).fill(null);
      }
      current.push(day);
      if (current.length === 7) {
        columns.push(current);
        current = [];
      }
    });
    if (current.length > 0) columns.push([...current, ...Array(7 - current.length).fill(null)]);
    return columns;
  }, [data]);

  const intensity = (value: number) => {
    if (value <= 0) return 0.06;
    if (value < 25) return 0.25;
    if (value < 50) return 0.45;
    if (value < 75) return 0.68;
    return 1;
  };

  /*
   * `min-w-0` est indispensable : une annee de carres fait environ 780 px de
   * large, largeur fixe par nature. Sans cette regle, ce conteneur — enfant
   * d'un `flex`/`grid` dont la taille minimale vaut par defaut le contenu —
   * refusait de retrecir sous 780 px, et c'est la PAGE ENTIERE qui se mettait
   * a defiler horizontalement au lieu de la seule frise.
   */
  return (
    <div className="min-w-0 overflow-x-auto pb-1">
      <div className="flex gap-[3px]" role="img" aria-label={`Regularite sur ${data.length} jours`}>
        <div className="mr-1 flex flex-col gap-[3px]">
          {weekdayLabels.map((label, index) => (
            <span key={index} className="h-[11px] w-3 text-[8px] leading-[11px] text-[var(--text-faint)]">
              {label}
            </span>
          ))}
        </div>
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-[3px]">
            {week.map((day, dayIndex) => (
              <div
                key={dayIndex}
                title={day ? `${day.date} — ${day.value}%` : undefined}
                className={cx('size-[11px] rounded-[3px]', day && 'cursor-pointer transition-transform hover:scale-125')}
                style={{
                  background: day ? color : 'transparent',
                  opacity: day ? intensity(day.value) : 0,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Sparkline ---------------------------------------------------------------

export function Sparkline({
  values,
  color = '#e9b8d5',
  width = 96,
  height = 28,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((value, index) => ({
    x: (index / (values.length - 1)) * width,
    y: height - ((value - min) / span) * (height - 4) - 2,
  }));

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={smoothPath(points)} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

/** Anneau de progression compact (score de discipline, objectifs...). */
export function RingProgress({
  value,
  size = 120,
  thickness = 10,
  color = '#fbc7da',
  label,
  sublabel,
}: {
  value: number;
  size?: number;
  thickness?: number;
  color?: string;
  label?: string;
  sublabel?: string;
}) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        role="img"
        aria-label={`${label ?? 'Progression'} : ${Math.round(clamped)}%`}
      >
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-2)" strokeWidth={thickness} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      {/* Le contenu central est borne au diametre interieur de l'anneau pour
          qu'un libelle long passe a la ligne au lieu de deborder sur le trace. */}
      <div
        className="absolute px-1 text-center"
        style={{ maxWidth: size - thickness * 2 - 6 }}
      >
        <div className="text-xl font-semibold leading-none text-[var(--text)]">
          {Math.round(clamped)}%
        </div>
        {sublabel && (
          <div className="mt-0.5 text-[9px] leading-tight text-balance text-[var(--text-faint)]">
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
}

export { PALETTE };
