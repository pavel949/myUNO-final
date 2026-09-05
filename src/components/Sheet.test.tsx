import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sheet } from './Sheet';

describe('Sheet', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <Sheet open={false} title="Record cash" onClose={vi.fn()} closeLabel="Close">
        <p>content</p>
      </Sheet>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders its title and children when open', () => {
    render(
      <Sheet open title="Record cash · Michael Chen" onClose={vi.fn()} closeLabel="Close">
        <p>Amount due ฿18,400</p>
      </Sheet>
    );
    expect(screen.getByText('Record cash · Michael Chen')).toBeInTheDocument();
    expect(screen.getByText('Amount due ฿18,400')).toBeInTheDocument();
  });

  it('closes when the close button is clicked', async () => {
    const onClose = vi.fn();
    render(
      <Sheet open title="Record cash" onClose={onClose} closeLabel="Close">
        <p>content</p>
      </Sheet>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes when the backdrop is clicked, not when the panel is clicked', async () => {
    const onClose = vi.fn();
    render(
      <Sheet open title="Record cash" onClose={onClose} closeLabel="Close">
        <p>content</p>
      </Sheet>
    );
    await userEvent.click(screen.getByText('content'));
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
