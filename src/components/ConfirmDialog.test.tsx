import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <ConfirmDialog
        open={false}
        title="Cancel booking?"
        confirmLabel="Cancel booking"
        cancelLabel="Keep booking"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('states every consequence before the person can commit', () => {
    render(
      <ConfirmDialog
        open
        title="Cancel booking B-707 · Jan 4–12?"
        consequences={['The unit is released to availability immediately.', '฿32,940 is refunded under policy flex-7.']}
        consequencesHeading="What happens:"
        confirmLabel="Cancel booking"
        cancelLabel="Keep booking"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('The unit is released to availability immediately.')).toBeInTheDocument();
    expect(screen.getByText('฿32,940 is refunded under policy flex-7.')).toBeInTheDocument();
  });

  it('calls onConfirm / onCancel from the right buttons', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Cancel booking?"
        confirmLabel="Cancel booking"
        cancelLabel="Keep booking"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancel booking' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: 'Keep booking' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('disables confirm until the typed confirmation matches, for irreversible acts', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Delete account?"
        confirmLabel="Delete permanently"
        cancelLabel="Keep account"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
        confirmVariant="destructive"
        typedConfirmation={{ requiredText: 'DELETE', label: 'Type DELETE to confirm' }}
      />
    );
    const confirmButton = screen.getByRole('button', { name: 'Delete permanently' });
    expect(confirmButton).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
    expect(confirmButton).not.toBeDisabled();

    await userEvent.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
