import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button component', () => {
  describe('variants', () => {
    it('renders primary variant', () => {
      render(<Button variant="primary">Click me</Button>);
      const button = screen.getByRole('button', { name: /click me/i });
      expect(button).toHaveClass('bg-brand-andaman');
    });

    it('renders secondary variant', () => {
      render(<Button variant="secondary">Click me</Button>);
      const button = screen.getByRole('button', { name: /click me/i });
      expect(button).toHaveClass('border-border-line');
    });

    it('renders ghost variant', () => {
      render(<Button variant="ghost">Click me</Button>);
      const button = screen.getByRole('button', { name: /click me/i });
      expect(button).toHaveClass('text-brand-andaman');
    });

    it('renders destructive variant', () => {
      render(<Button variant="destructive">Delete</Button>);
      const button = screen.getByRole('button', { name: /delete/i });
      expect(button).toHaveClass('bg-state-error');
    });
  });

  describe('sizes', () => {
    it('renders small size', () => {
      render(<Button size="sm">Small</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-40');
    });

    it('renders medium size (default)', () => {
      render(<Button size="md">Medium</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-48');
    });

    it('renders large size', () => {
      render(<Button size="lg">Large</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-56');
    });
  });

  describe('states', () => {
    it('renders disabled state', () => {
      render(<Button disabled>Disabled</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('disabled:opacity-50');
    });

    it('renders loading state', () => {
      render(<Button isLoading>Loading</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      // Spinner should be present
      const spinner = button.querySelector('svg');
      expect(spinner).toBeTruthy();
    });

    it('renders full width', () => {
      render(<Button fullWidth>Full Width</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('w-full');
    });
  });

  describe('interactions', () => {
    it('handles click events', async () => {
      const onClick = vi.fn();
      render(<Button onClick={onClick}>Click me</Button>);
      const button = screen.getByRole('button');
      await userEvent.click(button);
      expect(onClick).toHaveBeenCalledOnce();
    });

    it('does not trigger click when disabled', async () => {
      const onClick = vi.fn();
      render(
        <Button onClick={onClick} disabled>
          Disabled
        </Button>
      );
      const button = screen.getByRole('button');
      await userEvent.click(button);
      expect(onClick).not.toHaveBeenCalled();
    });
  });
});
