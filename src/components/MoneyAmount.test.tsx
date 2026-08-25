// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MoneyAmount } from './MoneyAmount';

// Q55 retrofit: MoneyAmount is the single satang-in money formatter every
// screen must share. This locks in the one contract — satang in, baht out —
// so the satang/baht bug (Q47) can't be reintroduced by a call site
// forgetting to divide (or dividing twice).
describe('MoneyAmount', () => {
  it('takes satang and renders baht, thousands-spaced with a ฿ prefix', () => {
    render(<MoneyAmount satang={250000} />);
    expect(screen.getByText('฿2,500')).toBeInTheDocument();
  });

  it('rounds to whole baht (satang-rounded per doc 02)', () => {
    render(<MoneyAmount satang={123456} />);
    // 123456 / 100 = 1234.56 -> rounds to 1235
    expect(screen.getByText('฿1,235')).toBeInTheDocument();
  });

  it('renders zero as ฿0', () => {
    render(<MoneyAmount satang={0} />);
    expect(screen.getByText('฿0')).toBeInTheDocument();
  });

  it('renders a large amount fully thousands-spaced (no K/M compaction)', () => {
    render(<MoneyAmount satang={150_000_000} />);
    expect(screen.getByText('฿1,500,000')).toBeInTheDocument();
  });

  it('renders negative amounts with a minus sign in state.error', () => {
    render(<MoneyAmount satang={-50000} />);
    const el = screen.getByText('−฿500');
    expect(el).toBeInTheDocument();
    expect(el.className).toContain('text-state-error');
  });

  it('does not carry the error class for positive/zero amounts', () => {
    render(<MoneyAmount satang={10000} />);
    const el = screen.getByText('฿100');
    expect(el.className).not.toContain('text-state-error');
  });

  it('merges an extra className onto the token defaults', () => {
    render(<MoneyAmount satang={10000} className="text-heading-2" />);
    const el = screen.getByText('฿100');
    expect(el.className).toContain('text-heading-2');
    expect(el.className).toContain('font-display');
    expect(el.className).toContain('tabular-nums');
  });
});
