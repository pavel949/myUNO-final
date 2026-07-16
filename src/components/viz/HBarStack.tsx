'use client';

import { useState } from 'react';
import { CHART_SURFACE, CHART_INK } from './palette';
import ChartTable from './ChartTable';

export interface HBarSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

export interface HBarRow {
  label: string;
  segments: HBarSegment[];
}

/**
 * HBarStack — horizontal stacked bars (part-to-whole per row; also the
 * ordinal funnel when each row has a single segment). 2px surface gaps
 * between segments, direct row totals, segment hover tooltip, legend when
 * ≥2 segments, table-view toggle.
 */
export default function HBarStack({
  rows,
  formatValue = (v: number) => String(v),
  legendLabels,
  valueHeader,
  labelHeader,
  tableToggleLabels,
  emptyLabel,
}: {
  rows: HBarRow[];
  formatValue?: (v: number) => string;
  /** Legend entries — required when rows carry ≥2 segments. */
  legendLabels?: { label: string; color: string }[];
  valueHeader: string;
  labelHeader: string;
  tableToggleLabels: { show: string; hide: string };
  emptyLabel: string;
}) {
  const [hovered, setHovered] = useState<{ row: number; seg: number } | null>(null);
  const [showTable, setShowTable] = useState(false);

  if (rows.length === 0) {
    return <p className="text-small text-text-secondary">{emptyLabel}</p>;
  }

  const totals = rows.map((r) => r.segments.reduce((s, seg) => s + seg.value, 0));
  const max = Math.max(...totals, 1);
  const multiSegment = rows.some((r) => r.segments.length > 1);

  return (
    <div>
      {multiSegment && legendLabels && legendLabels.length > 0 ? (
        <div className="flex flex-wrap gap-16 mb-8">
          {legendLabels.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-6 text-small text-text-secondary">
              <span
                className="inline-block w-12 h-12 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
                aria-hidden
              />
              {item.label}
            </span>
          ))}
        </div>
      ) : null}
      <div className="space-y-8">
        {rows.map((row, ri) => {
          const total = totals[ri];
          return (
            <div key={row.label + ri} className="flex items-center gap-12">
              <span className="shrink-0 text-small text-text-secondary truncate" style={{ width: '9rem' }}>
                {row.label}
              </span>
              <div className="flex-1 relative flex items-center" style={{ height: 20 }}>
                <div className="flex w-full" style={{ gap: 2 }}>
                  {row.segments.map((seg, si) => {
                    const pct = (seg.value / max) * 100;
                    if (seg.value <= 0) return null;
                    const isHovered = hovered?.row === ri && hovered?.seg === si;
                    return (
                      <div
                        key={seg.key}
                        className="relative"
                        style={{
                          width: `${pct}%`,
                          minWidth: 4,
                          height: 14,
                          backgroundColor: seg.color,
                          borderRadius: si === row.segments.length - 1 ? '0 4px 4px 0' : 0,
                          outline: isHovered ? `2px solid ${CHART_INK}` : 'none',
                          outlineOffset: 1,
                          boxShadow: `0 0 0 1px ${CHART_SURFACE}`,
                        }}
                        onMouseEnter={() => setHovered({ row: ri, seg: si })}
                        onMouseLeave={() => setHovered(null)}
                      >
                        {isHovered ? (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 z-10 pointer-events-none bg-brand-deep text-on-dark-text text-small rounded-sm px-8 py-4 shadow-float whitespace-nowrap">
                            {seg.label} · {formatValue(seg.value)}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
              <span className="shrink-0 text-small font-semibold text-text-ink tabular-nums">
                {formatValue(total)}
              </span>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setShowTable((s) => !s)}
        className="mt-8 text-small text-brand-andaman font-semibold hover:underline"
      >
        {showTable ? tableToggleLabels.hide : tableToggleLabels.show}
      </button>
      {showTable ? (
        <ChartTable
          headers={[
            labelHeader,
            ...(multiSegment
              ? Array.from(new Set(rows.flatMap((r) => r.segments.map((s) => s.label))))
              : [valueHeader]),
          ]}
          rows={rows.map((row, ri) =>
            multiSegment
              ? [
                  row.label,
                  ...Array.from(
                    new Set(rows.flatMap((r) => r.segments.map((s) => s.label)))
                  ).map((segLabel) =>
                    formatValue(
                      row.segments.find((s) => s.label === segLabel)?.value ?? 0
                    )
                  ),
                ]
              : [row.label, formatValue(totals[ri])]
          )}
        />
      ) : null}
    </div>
  );
}
