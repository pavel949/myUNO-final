'use client';

import { useState } from 'react';
import { CHART_SERIES, CHART_GRID, CHART_AXIS_TEXT, CHART_INK } from './palette';
import ChartTable from './ChartTable';

export interface BarDatum {
  label: string;
  value: number;
}

/**
 * BarChart — vertical single-series bars (magnitude over categories/months).
 * Marks per doc 06 dataviz: 4px rounded data-end anchored to a square
 * baseline, 2px surface gaps, recessive hairline grid, selective direct
 * labels (max + latest), per-bar hover tooltip, table-view toggle.
 */
export default function BarChart({
  data,
  color = CHART_SERIES[0],
  height = 180,
  formatValue = (v: number) => String(v),
  valueHeader,
  labelHeader,
  tableToggleLabels,
  emptyLabel,
}: {
  data: BarDatum[];
  color?: string;
  height?: number;
  formatValue?: (v: number) => string;
  /** Table headers + toggle text come from the content layer. */
  valueHeader: string;
  labelHeader: string;
  tableToggleLabels: { show: string; hide: string };
  emptyLabel: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  if (data.length === 0) {
    return <p className="text-small text-text-secondary">{emptyLabel}</p>;
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const maxIndex = data.findIndex((d) => d.value === Math.max(...data.map((x) => x.value)));
  const width = 560;
  const padTop = 22;
  const padBottom = 24;
  const padLeft = 8;
  const padRight = 8;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;
  const band = innerW / data.length;
  const barW = Math.max(6, Math.min(48, band - Math.max(2, band * 0.25)));

  const barY = (v: number) => padTop + innerH - (v / max) * innerH;

  return (
    <div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto block"
          role="img"
        >
          {/* hairline grid at 0 / 50 / 100% of max */}
          {[0, 0.5, 1].map((f) => (
            <line
              key={f}
              x1={padLeft}
              x2={width - padRight}
              y1={padTop + innerH - f * innerH}
              y2={padTop + innerH - f * innerH}
              stroke={CHART_GRID}
              strokeWidth={1}
            />
          ))}
          {data.map((d, i) => {
            const x = padLeft + i * band + (band - barW) / 2;
            const y = barY(d.value);
            const h = padTop + innerH - y;
            const r = Math.min(4, barW / 2, h);
            const isHovered = hovered === i;
            const showLabel = i === maxIndex || i === data.length - 1 || isHovered;
            return (
              <g key={d.label + i}>
                {h > 0 ? (
                  <path
                    d={`M ${x} ${padTop + innerH} V ${y + r} Q ${x} ${y} ${x + r} ${y} H ${x + barW - r} Q ${x + barW} ${y} ${x + barW} ${y + r} V ${padTop + innerH} Z`}
                    fill={color}
                    opacity={hovered === null || isHovered ? 1 : 0.45}
                  />
                ) : null}
                {showLabel && d.value > 0 ? (
                  <text
                    x={x + barW / 2}
                    y={y - 6}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={600}
                    fill={CHART_INK}
                  >
                    {formatValue(d.value)}
                  </text>
                ) : null}
                <text
                  x={x + barW / 2}
                  y={height - 6}
                  textAnchor="middle"
                  fontSize={11}
                  fill={CHART_AXIS_TEXT}
                >
                  {d.label}
                </text>
                {/* full-band hover hit target, larger than the mark */}
                <rect
                  x={padLeft + i * band}
                  y={0}
                  width={band}
                  height={height}
                  fill="transparent"
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                />
              </g>
            );
          })}
        </svg>
        {hovered !== null ? (
          <div
            className="absolute -top-2 pointer-events-none bg-brand-deep text-on-dark-text text-small rounded-sm px-8 py-4 shadow-float whitespace-nowrap"
            style={{
              left: `${((padLeft + hovered * band + band / 2) / width) * 100}%`,
              transform: 'translateX(-50%)',
            }}
          >
            {data[hovered].label} · {formatValue(data[hovered].value)}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => setShowTable((s) => !s)}
        className="mt-4 text-small text-brand-andaman font-semibold hover:underline"
      >
        {showTable ? tableToggleLabels.hide : tableToggleLabels.show}
      </button>
      {showTable ? (
        <ChartTable
          headers={[labelHeader, valueHeader]}
          rows={data.map((d) => [d.label, formatValue(d.value)])}
        />
      ) : null}
    </div>
  );
}
