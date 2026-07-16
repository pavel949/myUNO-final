'use client';

import { useState } from 'react';
import { CHART_SERIES, CHART_GRID, CHART_AXIS_TEXT } from './palette';
import ChartTable from './ChartTable';

export interface LinePoint {
  label: string;
  value: number;
}

/**
 * LineChart — single-series trend over time. 2px line, hover crosshair with
 * ≥8px marker and tooltip, recessive hairline grid with axis-side scale
 * labels, table-view toggle.
 */
export default function LineChart({
  data,
  color = CHART_SERIES[0],
  height = 180,
  max,
  formatValue = (v: number) => String(v),
  valueHeader,
  labelHeader,
  tableToggleLabels,
  emptyLabel,
}: {
  data: LinePoint[];
  color?: string;
  height?: number;
  /** Fixed ceiling (e.g. 100 for percentages); defaults to data max. */
  max?: number;
  formatValue?: (v: number) => string;
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

  const ceil = max ?? Math.max(...data.map((d) => d.value), 1);
  const width = 560;
  const padTop = 16;
  const padBottom = 24;
  const padLeft = 36;
  const padRight = 12;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;
  const step = data.length > 1 ? innerW / (data.length - 1) : 0;
  const px = (i: number) => padLeft + i * step;
  const py = (v: number) => padTop + innerH - (Math.min(v, ceil) / ceil) * innerH;
  const pointsAttr = data.map((d, i) => `${px(i).toFixed(1)},${py(d.value).toFixed(1)}`).join(' ');

  return (
    <div>
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto block" role="img">
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line
                x1={padLeft}
                x2={width - padRight}
                y1={padTop + innerH - f * innerH}
                y2={padTop + innerH - f * innerH}
                stroke={CHART_GRID}
                strokeWidth={1}
              />
              <text
                x={padLeft - 6}
                y={padTop + innerH - f * innerH + 4}
                textAnchor="end"
                fontSize={10}
                fill={CHART_AXIS_TEXT}
              >
                {formatValue(Math.round(ceil * f))}
              </text>
            </g>
          ))}
          {hovered !== null ? (
            <line
              x1={px(hovered)}
              x2={px(hovered)}
              y1={padTop}
              y2={padTop + innerH}
              stroke={CHART_AXIS_TEXT}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          ) : null}
          {data.length > 1 ? (
            <polyline
              points={pointsAttr}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}
          {data.map((d, i) => (
            <g key={d.label + i}>
              {hovered === i || data.length === 1 ? (
                <circle cx={px(i)} cy={py(d.value)} r={4} fill={color} stroke="#FBF8F1" strokeWidth={2} />
              ) : null}
              <text
                x={px(i)}
                y={height - 6}
                textAnchor="middle"
                fontSize={11}
                fill={CHART_AXIS_TEXT}
              >
                {data.length <= 8 || i % 2 === 0 || i === data.length - 1 ? d.label : ''}
              </text>
              {/* band-wide hit target */}
              <rect
                x={px(i) - (step || width) / 2}
                y={0}
                width={step || width}
                height={height}
                fill="transparent"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              />
            </g>
          ))}
        </svg>
        {hovered !== null ? (
          <div
            className="absolute -top-2 pointer-events-none bg-brand-deep text-on-dark-text text-small rounded-sm px-8 py-4 shadow-float whitespace-nowrap"
            style={{
              left: `${(px(hovered) / width) * 100}%`,
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
