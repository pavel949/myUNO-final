import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select } from './Select';

describe('Select', () => {
  it('renders a label and options, and reports changes', async () => {
    const onChange = vi.fn();
    render(
      <Select label="Language" onChange={onChange}>
        <option value="en">English</option>
        <option value="ru">Русский</option>
      </Select>
    );
    expect(screen.getByText('Language')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole('combobox'), 'ru');
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('renders an error message and error border', () => {
    render(
      <Select label="Project" error="Choose a project">
        <option value="a">A</option>
      </Select>
    );
    expect(screen.getByText('Choose a project')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveClass('border-state-error');
  });
});
