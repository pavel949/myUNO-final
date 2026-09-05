import React from 'react';

interface CounterProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  decreaseLabel: string;
  increaseLabel: string;
  valueLabel?: string;
}

export function Counter({
  value,
  onChange,
  min = 0,
  max,
  decreaseLabel,
  increaseLabel,
  valueLabel,
}: CounterProps) {
  const atMin = value <= min;
  const atMax = max !== undefined && value >= max;

  return (
    <div className="inline-flex items-center gap-12">
      <button
        type="button"
        aria-label={decreaseLabel}
        disabled={atMin}
        onClick={() => onChange(value - 1)}
        className="w-44 h-44 rounded-full border border-border-line bg-surface-paper text-title text-text-ink hover:border-border-line-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-micro"
      >
        −
      </button>
      <span
        className="font-display text-title font-medium tabular-nums min-w-20 text-center"
        aria-live="polite"
        aria-label={valueLabel}
      >
        {value}
      </span>
      <button
        type="button"
        aria-label={increaseLabel}
        disabled={atMax}
        onClick={() => onChange(value + 1)}
        className="w-44 h-44 rounded-full border border-border-line bg-surface-paper text-title text-text-ink hover:border-border-line-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-micro"
      >
        +
      </button>
    </div>
  );
}
