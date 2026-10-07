import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AvailabilityPricingPanel from './AvailabilityPricingPanel';
import { UNIT_CALENDAR_LABEL_KEYS } from '@/app/libs/unitCalendarLabels';
const labels = Object.fromEntries(Object.keys(UNIT_CALENDAR_LABEL_KEYS).map(key => [key, key.split('.').at(-1)!]));
const response = (body: unknown, ok = true) => ({ ok, json: async () => body });
afterEach(() => vi.unstubAllGlobals());
function fillRule() {
  const form = screen.getByRole('button', { name: 'add_rule' }).closest('form')!;
  fireEvent.change(within(form).getByLabelText('start_date'), { target: { value: '2026-11-01' } });
  fireEvent.change(within(form).getByLabelText('end_date'), { target: { value: '2026-11-10' } });
  fireEvent.change(within(form).getByLabelText('nightly_rate'), { target: { value: '6500' } });
  return form;
}
describe('manual price form completion', () => {
  it('preserves entered dates and amount after a rejected write', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url, options) => options?.method === 'POST'
      ? response({ error: 'Rate could not be saved' }, false)
      : response({ blocks: [], rules: [] })));
    render(<AvailabilityPricingPanel unitId="unit" labels={labels} />);
    await screen.findByRole('button', { name: 'add_rule' });
    const form = fillRule();
    fireEvent.submit(form);
    await screen.findByText('Rate could not be saved');
    expect(within(form).getByLabelText('start_date')).toHaveValue('2026-11-01');
    expect(within(form).getByLabelText('nightly_rate')).toHaveValue(6500);
  });
  it('resets the captured form after confirmed asynchronous success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ blocks: [], rules: [] })));
    render(<AvailabilityPricingPanel unitId="unit" labels={labels} />);
    await screen.findByRole('button', { name: 'add_rule' });
    const form = fillRule();
    fireEvent.submit(form);
    await waitFor(() => expect(within(form).getByLabelText('start_date')).toHaveValue(''));
    expect(within(form).getByLabelText('nightly_rate')).toHaveValue(null);
  });
});
