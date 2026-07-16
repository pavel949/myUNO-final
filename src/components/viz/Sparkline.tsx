import { CHART_SERIES, CHART_GRID } from './palette';

/**
 * Sparkline — a bare trend line for table rows and KPI tiles (doc 06 S7
 * per-unit occupancy). No axes, no legend; the row it sits in names it.
 * Server-renderable; an SVG <title> carries the accessible summary.
 */
export default function Sparkline({
  values,
  title,
  width = 96,
  height = 28,
  color = CHART_SERIES[0],
  max,
}: {
  /** Ordered values, oldest → newest. */
  values: number[];
  /** Accessible one-line summary (from the content layer). */
  title: string;
  width?: number;
  height?: number;
  color?: string;
  /** Fixed scale ceiling (e.g. 1 for occupancy dots); defaults to data max. */
  max?: number;
}) {
  if (values.length === 0) {
    return (
      <svg width={width} height={height} role="img" aria-label={title}>
        <title>{title}</title>
        <line
          x1={2}
          y1={height / 2}
          x2={width - 2}
          y2={height / 2}
          stroke={CHART_GRID}
          strokeWidth={2}
          strokeDasharray="2 4"
        />
      </svg>
    );
  }

  const ceil = max ?? Math.max(...values, 1);
  const pad = 3;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const step = values.length > 1 ? innerW / (values.length - 1) : 0;
  const y = (v: number) => pad + innerH - (Math.min(v, ceil) / ceil) * innerH;
  const pointsAttr = values
    .map((v, i) => `${(pad + i * step).toFixed(1)},${y(v).toFixed(1)}`)
    .join(' ');
  const lastX = pad + (values.length - 1) * step;
  const lastY = y(values[values.length - 1]);

  return (
    <svg width={width} height={height} role="img" aria-label={title}>
      <title>{title}</title>
      {values.length > 1 ? (
        <polyline
          points={pointsAttr}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : null}
      <circle cx={lastX} cy={lastY} r={3} fill={color} />
    </svg>
  );
}
