'use client';

import React from 'react';
import { MoneyAmount } from './MoneyAmount';

export interface PriceLine {
  /** Pre-resolved label (already includes any interpolated values, e.g. "฿5,000 × 3 nights"). */
  label: string;
  /** Amount in satang. For discounts pass the positive magnitude and kind: 'discount'. */
  satang: number;
  kind?: 'charge' | 'discount';
}

export interface PriceBreakdownProps {
  lines: PriceLine[];
  totalLabel: string;
  totalSatang: number;
  /** Optional pre-resolved fine print under the total (e.g. taxes-included note). */
  note?: string;
  className?: string;
}

/**
 * PriceBreakdown — doc 06 §3 / S5. Itemised stay or order price. Every figure
 * flows through MoneyAmount (satang contract), so the guest sees exactly what
 * the server will charge. Discounts render in success colour with a minus sign.
 */
export const PriceBreakdown: React.FC<PriceBreakdownProps> = ({
  lines,
  totalLabel,
  totalSatang,
  note,
  className,
}) => {
  return (
    <div className={`space-y-12 ${className || ''}`}>
      {lines.map((line, index) => {
        const isDiscount = line.kind === 'discount';
        return (
          <div key={`${line.label}-${index}`} className="flex justify-between text-small">
            <span className="text-text-secondary">{line.label}</span>
            {isDiscount ? (
              <span className="font-medium text-state-success">
                −<MoneyAmount satang={Math.abs(line.satang)} />
              </span>
            ) : (
              <span className="font-medium text-text-ink">
                <MoneyAmount satang={line.satang} />
              </span>
            )}
          </div>
        );
      })}
      <div className="flex justify-between border-t border-border-line pt-12 text-subtitle font-bold">
        <span className="text-text-ink">{totalLabel}</span>
        <MoneyAmount satang={totalSatang} className="text-brand-andaman" />
      </div>
      {note && <p className="text-small text-text-secondary">{note}</p>}
    </div>
  );
};

PriceBreakdown.displayName = 'PriceBreakdown';
