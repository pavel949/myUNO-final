'use client';

import React from 'react';

interface CounterProps {
  label?: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  decrementLabel?: string;
  incrementLabel?: string;
}

/**
 * Counter — doc 06 §3.1: "− value + steppers (guests, quantity); 44px
 * targets." Used by the guest counter on search/booking and quantity
 * pickers in the services marketplace.
 */
export const Counter: React.FC<CounterProps> = ({
  label,
  value,
  min = 0,
  max = Infinity,
  onChange,
  decrementLabel = 'Decrease',
  incrementLabel = 'Increase',
}) => {
  const canDecrement = value > min;
  const canIncrement = value < max;

  return (
    <div className="flex items-center gap-16">
      {label && <span className="text-body text-text-ink">{label}</span>}
      <div className="flex items-center gap-12 ml-auto">
        <button
          type="button"
          aria-label={decrementLabel}
          disabled={!canDecrement}
          onClick={() => canDecrement && onChange(value - 1)}
          className="w-44 h-44 rounded-full border border-border-line bg-surface-paper text-text-ink text-title flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:border-border-line-2 transition-colors duration-micro"
        >
          −
        </button>
        <span className="font-display text-title tabular-nums w-24 text-center" aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          aria-label={incrementLabel}
          disabled={!canIncrement}
          onClick={() => canIncrement && onChange(value + 1)}
          className="w-44 h-44 rounded-full border border-border-line bg-surface-paper text-text-ink text-title flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:border-border-line-2 transition-colors duration-micro"
        >
          +
        </button>
      </div>
    </div>
  );
};
