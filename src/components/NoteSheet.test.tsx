import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NoteSheet } from './NoteSheet';

describe('NoteSheet', () => {
  it('disables submit until a note is entered', () => {
    render(
      <NoteSheet
        open
        onClose={vi.fn()}
        closeLabel="Close"
        title="Resolve ticket"
        noteLabel="Resolution note"
        value=""
        onChange={vi.fn()}
        submitLabel="Resolve"
        busy={false}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'Resolve' })).toBeDisabled();
  });

  it('leaves submit enabled with an empty note when optional', () => {
    render(
      <NoteSheet
        open
        onClose={vi.fn()}
        closeLabel="Close"
        title="Decline order"
        noteLabel="Reason (optional)"
        value=""
        onChange={vi.fn()}
        submitLabel="Decline"
        optional
        busy={false}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'Decline' })).not.toBeDisabled();
  });

  it('enables and submits once a note is present', async () => {
    const onSubmit = vi.fn();
    render(
      <NoteSheet
        open
        onClose={vi.fn()}
        closeLabel="Close"
        title="Resolve ticket"
        noteLabel="Resolution note"
        value="Replaced the part."
        onChange={vi.fn()}
        submitLabel="Resolve"
        busy={false}
        onSubmit={onSubmit}
      />
    );
    const submit = screen.getByRole('button', { name: 'Resolve' });
    expect(submit).not.toBeDisabled();
    await userEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});
