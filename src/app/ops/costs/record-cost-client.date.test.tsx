import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import RecordCostClient from './record-cost-client';

const props = {
  units: [
    { id: 'unit-a', name: 'Villa A', projectName: 'Project A' },
    { id: 'unit-b', name: 'Villa B', projectName: 'Project B' },
  ],
  recent: [{
    id: 'existing-cost', entryType: 'cleaning_cost', amountThb: 10000,
    occurredOn: '2026-10-09', description: 'Existing cost', unitName: 'Villa A',
  }],
  labels: {
    'ops.costs.unit': 'Unit',
    'ops.costs.date': 'Date incurred',
    'ops.costs.description': 'What it was for',
  },
};

afterEach(() => vi.useRealTimers());

describe('expense initial operating day', () => {
  it.each([
    ['2026-10-10T09:00:00.000Z', '2026-10-10'],
    ['2026-10-10T16:59:59.999Z', '2026-10-10'],
    ['2026-10-10T17:00:00.000Z', '2026-10-11'],
    ['2026-10-10T18:28:00.000Z', '2026-10-11'],
  ])('initializes %s to Bangkok day %s', (instant, day) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(instant));
    render(<RecordCostClient {...props} />);
    expect(screen.getByLabelText('Date incurred')).toHaveValue(day);
    // Stored ledger business dates are already calendar days, not instants.
    expect(screen.getByRole('cell', { name: '2026-10-09' })).toBeInTheDocument();
  });

  it('preserves an edited business date across midnight, unit changes and rerenders', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-10T16:59:59.999Z'));
    const view = render(<RecordCostClient {...props} />);
    fireEvent.change(screen.getByLabelText('Date incurred'), { target: { value: '2026-10-08' } });
    vi.setSystemTime(new Date('2026-10-10T17:00:00.000Z'));
    fireEvent.change(screen.getByLabelText('Unit'), { target: { value: 'unit-b' } });
    fireEvent.change(screen.getByLabelText('What it was for'), { target: { value: 'Cleaning' } });
    view.rerender(<RecordCostClient {...props} embedded />);
    expect(screen.getByLabelText('Date incurred')).toHaveValue('2026-10-08');
    expect(screen.getByRole('cell', { name: '2026-10-09' })).toBeInTheDocument();
  });
});
