'use client';

import React from 'react';

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
  const bahtRounded = Math.round(satang / 100);
  const negative = bahtRounded < 0;
  const formatted = `฿${Math.abs(bahtRounded).toLocaleString('en-US')}`;

  const classes = [
    'font-display font-medium tabular-nums',
    negative ? 'text-state-error' : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  return <span className={classes}>{negative ? `−${formatted}` : formatted}</span>;
};
