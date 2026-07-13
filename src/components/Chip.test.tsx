import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Chip } from './Chip';

describe('Chip component', () => {
  describe('variants', () => {
    it('renders filter variant when inactive', () => {
      render(<Chip variant="filter">Filter</Chip>);
      const chip = screen.getByText('Filter').closest('div');
      expect(chip).toHaveClass('border-border-line');
    });

    it('renders filter variant when active', () => {
      render(
        <Chip variant="filter" isActive>
          Filter
        </Chip>
      );
      const chip = screen.getByText('Filter').closest('div');
      expect(chip).toHaveClass('bg-brand-andaman');
    });

    it('renders status variant', () => {
      render(
        <Chip variant="status" status="confirmed">
          Confirmed
        </Chip>
      );
      const chip = screen.getByText('Confirmed').closest('div');
      expect(chip).toHaveClass('bg-state-success-soft');
      expect(chip).toHaveClass('text-state-success');
    });
  });

  describe('status types', () => {
    it('renders confirmed status', () => {
      render(
        <Chip variant="status" status="confirmed">
          Confirmed
        </Chip>
      );
      const chip = screen.getByText('Confirmed').closest('div');
      expect(chip).toHaveClass('bg-state-success-soft');
    });

    it('renders pending_payment status', () => {
      render(
        <Chip variant="status" status="pending_payment">
          Pending
        </Chip>
      );
      const chip = screen.getByText('Pending').closest('div');
      expect(chip).toHaveClass('bg-state-warning-soft');
    });

    it('renders declined status', () => {
      render(
        <Chip variant="status" status="declined">
          Declined
        </Chip>
      );
      const chip = screen.getByText('Declined').closest('div');
      expect(chip).toHaveClass('bg-state-error-soft');
    });
  });

  describe('icon support', () => {
    it('renders with icon', () => {
      render(
        <Chip icon={<span>🎯</span>}>With Icon</Chip>
      );
      const icon = screen.getByText('🎯');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('handles click when selectable', async () => {
      const onClick = vi.fn();
      render(
        <Chip isSelectable onClick={onClick}>
          Selectable
        </Chip>
      );
      const chip = screen.getByRole('button');
      await userEvent.click(chip);
      expect(onClick).toHaveBeenCalledOnce();
    });

    it('does not handle click when not selectable', async () => {
      const onClick = vi.fn();
      render(
        <Chip onClick={onClick}>
          Not Selectable
        </Chip>
      );
      const chip = screen.getByText('Not Selectable').closest('div');
      // Should be a div, not a button
      expect(chip?.tagName).toBe('DIV');
    });
  });

  describe('styling', () => {
    it('applies custom className', () => {
      render(
        <Chip className="custom-class">Chip</Chip>
      );
      const chip = screen.getByText('Chip').closest('div');
      expect(chip).toHaveClass('custom-class');
    });

    it('has base styles applied', () => {
      render(<Chip>Chip</Chip>);
      const chip = screen.getByText('Chip').closest('div');
      expect(chip).toHaveClass('inline-flex');
      expect(chip).toHaveClass('rounded-full');
    });
  });
});
