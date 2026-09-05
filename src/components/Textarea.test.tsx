import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Textarea } from './Textarea';

describe('Textarea', () => {
  it('renders a label and required marker', () => {
    render(<Textarea label="Note to provider" required />);
    expect(screen.getByText('Note to provider')).toBeInTheDocument();
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('renders an error message and error border', () => {
    render(<Textarea label="Note" error="This field is required" />);
    expect(screen.getByText('This field is required')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveClass('border-state-error');
  });

  it('renders help text only when there is no error', () => {
    render(<Textarea label="Note" helpText="Visible to staff only" />);
    expect(screen.getByText('Visible to staff only')).toBeInTheDocument();
  });
});
