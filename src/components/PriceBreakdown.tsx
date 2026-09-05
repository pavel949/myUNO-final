import React from 'react';
import { MoneyAmount } from './MoneyAmount';

export interface PriceBreakdownItem {
  id: string;
  label: string;
  satang: number;
  note?: string;
}

interface PriceBreakdownProps {
  lines: PriceBreakdownItem[];
  totalLabel: string;
}

export function PriceBreakdown({ lines, totalLabel }: PriceBreakdownProps) {
  const totalSatang = lines.reduce((sum, line) => sum + line.satang, 0);

  return (
    <div className="border border-border-line rounded-md p-16 bg-surface-paper">
      {lines.map((line) => (
        <div key={line.id} className="mb-8 last:mb-0">
          <div className="flex justify-between gap-16">
            <span className="text-body text-text-ink">{line.label}</span>
            <MoneyAmount satang={line.satang} />
          </div>
          {line.note && <p className="text-small text-text-stone mt-0 mb-12">{line.note}</p>}
        </div>
      ))}
      <div className="flex justify-between gap-16 pt-12 mt-4 border-t border-border-line">
        <span className="text-body-strong text-text-ink">{totalLabel}</span>
        <MoneyAmount satang={totalSatang} className="text-title font-semibold" />
      </div>
    </div>
  );
}
