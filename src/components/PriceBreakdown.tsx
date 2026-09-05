import React from 'react';
import { MoneyAmount } from './MoneyAmount';

export interface PriceBreakdownItem {
  label: string;
  /** Amount in satang — negative for credits/discounts (rendered in state.error per MoneyAmount). */
  amountSatang: number;
  /** Rule attribution shown under the label, e.g. "high season · rule RS-2026-HI" (doc 06 §3.2). */
  attribution?: string;
}

interface PriceBreakdownProps {
  items: PriceBreakdownItem[];
  totalLabel: string;
  totalSatang: number;
  className?: string;
}

/**
 * PriceBreakdown — doc 06 §3.2: line items + rule attributions + total row.
 * Always the server's numbers; this component only lays them out; it never
 * computes a price itself (CURSOR_PROMPT ground rule 6: server computes,
 * client displays).
 *
 * Each row is a flex layout with `flex-shrink-0` on the figure so a long
 * label wraps onto a second line rather than the amount truncating or the
 * two columns colliding — the rule the Russian pass (board 21) forced into
 * every label/amount pair, not just this one.
 */
export const PriceBreakdown: React.FC<PriceBreakdownProps> = ({ items, totalLabel, totalSatang, className }) => {
  return (
    <div className={`border border-border-line rounded-md p-16 bg-surface-paper ${className || ''}`}>
      {items.map((item, i) => (
        <div key={i} className={item.attribution ? 'mb-12' : 'mb-8'}>
          <div className="flex justify-between gap-16">
            <span className="text-body text-text-ink">{item.label}</span>
            <span className="flex-shrink-0">
              <MoneyAmount satang={item.amountSatang} />
            </span>
          </div>
          {item.attribution && <p className="text-small text-text-stone mt-4">{item.attribution}</p>}
        </div>
      ))}
      <div className="flex justify-between gap-16 pt-12 border-t border-border-line">
        <span className="text-body-strong text-text-ink">{totalLabel}</span>
        <span className="flex-shrink-0">
          <MoneyAmount satang={totalSatang} className="text-title" />
        </span>
      </div>
    </div>
  );
};
