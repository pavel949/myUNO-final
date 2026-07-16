import { CHART_SEQUENTIAL, CHART_GRID } from './palette';

export interface HeatDay {
  /** YYYY-MM-DD */
  date: string;
  /** null = no data for that day */
  occupied: boolean | null;
}

/**
 * MonthHeatStrip — one cell per day, sequential teal: near-surface for
 * vacant, dark step for occupied, hairline outline for no-data. Binary
 * magnitude on a calendar row (the MC calendar tab). Server-renderable;
 * each cell carries an SVG <title> tooltip.
 */
export default function MonthHeatStrip({
  days,
  occupiedLabel,
  vacantLabel,
  noDataLabel,
  cellSize = 14,
}: {
  days: HeatDay[];
  occupiedLabel: string;
  vacantLabel: string;
  noDataLabel: string;
  cellSize?: number;
}) {
  const gap = 2;
  const width = days.length * (cellSize + gap) - gap;
  const height = cellSize;
  return (
    <svg
      width={width}
      height={height}
      className="max-w-full h-auto"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
    >
      {days.map((day, i) => {
        const x = i * (cellSize + gap);
        const state =
          day.occupied === null ? noDataLabel : day.occupied ? occupiedLabel : vacantLabel;
        return (
          <rect
            key={day.date}
            x={x}
            y={0}
            width={cellSize}
            height={cellSize}
            rx={3}
            fill={
              day.occupied === null
                ? 'transparent'
                : day.occupied
                  ? CHART_SEQUENTIAL[3]
                  : CHART_SEQUENTIAL[0]
            }
            stroke={day.occupied === null ? CHART_GRID : 'none'}
            strokeWidth={day.occupied === null ? 1 : 0}
          >
            <title>{`${day.date} · ${state}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}
