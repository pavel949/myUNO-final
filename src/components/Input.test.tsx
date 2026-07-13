import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from './Input';

describe('Input component', () => {
  describe('basic rendering', () => {
    it('renders input field', () => {
      render(<Input />);
      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
    });

    it('renders with label', () => {
      render(<Input label="Email" />);
      const label = screen.getByText('Email');
      expect(label).toBeInTheDocument();
    });

    it('renders required marker', () => {
      render(<Input label="Email" required />);
      const requiredMarker = screen.getByText('*');
      expect(requiredMarker).toBeInTheDocument();
    });
  });

  describe('placeholder and value', () => {
    it('renders with placeholder', () => {
      render(<Input placeholder="Enter text" />);
      const input = screen.getByPlaceholderText('Enter text');
      expect(input).toBeInTheDocument();
    });

    it('handles value changes', async () => {
      const { container } = render(<Input defaultValue="" />);
      const input = container.querySelector('input') as HTMLInputElement;
      await userEvent.type(input, 'test value');
      expect(input.value).toBe('test value');
    });
  });

  describe('validation states', () => {
    it('renders error message', () => {
      render(<Input error="This field is required" />);
      const errorMessage = screen.getByText('This field is required');
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage).toHaveClass('text-state-error');
    });

    it('renders help text', () => {
      render(<Input helpText="Enter a valid email" />);
      const helpText = screen.getByText('Enter a valid email');
      expect(helpText).toBeInTheDocument();
      expect(helpText).toHaveClass('text-text-stone');
    });

    it('does not show help text when error exists', () => {
      render(
        <Input
          error="Invalid email"
          helpText="Enter a valid email"
        />
      );
      const helpText = screen.queryByText('Enter a valid email');
      expect(helpText).not.toBeInTheDocument();
    });
  });

  describe('disabled state', () => {
    it('renders disabled input', () => {
      render(<Input disabled />);
      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
      expect(input).toHaveClass('disabled:text-text-stone-2');
    });

    it('prevents typing in disabled input', async () => {
      render(<Input disabled />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      await userEvent.type(input, 'test');
      expect(input.value).toBe('');
    });
  });
});
