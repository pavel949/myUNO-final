import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TypedPaymentSheet } from './TypedPaymentSheet';
import type { ComponentProps } from 'react';

function renderSheet(overrides: Partial<ComponentProps<typeof TypedPaymentSheet>> = {}) {
  const onRefChange = vi.fn();
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  render(
    <TypedPaymentSheet
      open
      onClose={onClose}
      closeLabel="Close"
      title="Record cash · Michael Chen"
      subtitle="A-204 · booking BK-2026-0121"
      amountThb={18400}
      amountDueLabel="Amount due"
      refLabel="Receipt number"
      refValue=""
      onRefChange={onRefChange}
      refHelpText="From the paper receipt book at the desk."
      submitLabel="Record ฿18,400 cash"
      requiredHint="Both the reference and the count are required."
      busy={false}
      onSubmit={onSubmit}
      {...overrides}
    />
  );
  return { onRefChange, onSubmit, onClose };
}

describe('TypedPaymentSheet', () => {
  it('shows the amount due and disables submit until a reference is entered', () => {
    renderSheet();
    expect(screen.getByText('฿18,400')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Record ฿18,400 cash' })).toBeDisabled();
  });

  it('stays disabled without the counted confirmation when one is required', async () => {
    renderSheet({
      refValue: 'RC-2026-0007',
      confirmationLabel: 'I have counted ฿18,400 and it is in the safe.',
    });
    const submit = screen.getByRole('button', { name: 'Record ฿18,400 cash' });
    expect(submit).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox'));
    expect(submit).not.toBeDisabled();
  });

  it('enables submit from a reference alone when there is no confirmation checkbox', () => {
    renderSheet({ refValue: 'TXN-991' });
    expect(screen.getByRole('button', { name: 'Record ฿18,400 cash' })).not.toBeDisabled();
  });

  it('calls onSubmit when the button is clicked while ready', async () => {
    const { onSubmit } = renderSheet({ refValue: 'TXN-991' });
    await userEvent.click(screen.getByRole('button', { name: 'Record ฿18,400 cash' }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});
