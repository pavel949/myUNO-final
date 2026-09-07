'use client';

import React from 'react';
import { formatBaht, satangToBaht } from '@/lib/money';

export interface MoneyAmountProps {
  /**
   * Amount in satang (THB × 100) — the domain-layer money unit everywhere
   * in the platform (doc 02 money rules, CLAUDE.md "Money rules"). This is
   * the ONE contract: every caller hands satang, MoneyAmount divides by 100
   * and renders baht. Never pass an already-divided baht number here.
   */
  satang: number;
  /**
   * Extra classes layered on top of the token defaults. MoneyAmount itself
   * only sets the digit typeface (Outfit / font-display), the doc 06
   * `type.num` weight, and tabular figures — it does not fix a font-size,
   * so it inherits whatever size the surrounding element (a StatTile value,
   * a table cell, a card headline) already uses.
   */
  className?: string;
}

/**
 * MoneyAmount — doc 06 §3.1: `type.num`, `฿` prefix, thousands-spaced;
 * negative in `state.error`; always satang-rounded.
 *
 * The single place that turns satang into a displayed baht figure. Every
 * screen that shows money renders it through this component instead of a
 * local `formatCurrency` — that duplication is exactly how the satang/baht
 * display bug (Q47) kept recurring across the codebase.
 */
export const MoneyAmount: React.FC<MoneyAmountProps> = ({ satang, className }) => {
  // Formatting lives in src/lib/money.ts so a figure never depends on where it
  // is shown: this component and a notification body render the same amount
  // identically because they call the same function (T-053).
  const formatted = formatBaht(satang);
  const negative = satangToBaht(satang) < 0;

  // Board 21: in every label-and-amount pair the label wraps and the figure
  // does not. Carried by the primitive rather than by each call site, so a
  // longer RU/TH label can never push a price onto two lines.
  const classes = [
    'font-display font-medium tabular-nums shrink-0 whitespace-nowrap',
    negative ? 'text-state-error' : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  return <span className={classes}>{formatted}</span>;
};
