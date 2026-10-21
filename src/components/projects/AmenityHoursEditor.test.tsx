import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { amenityHoursFromForm } from '@/modules/projects/amenity-usage';
import AmenityHoursEditor from './AmenityHoursEditor';
afterEach(cleanup);
describe('hours editor', () => {
  it('offers ordinary time controls and separate staff hours', () => {
    render(<AmenityHoursEditor timezone="Asia/Bangkok" value={{ daily: [['00:00','24:00']], staffContact: [['09:00','18:00']] }} />);
    expect((screen.getByLabelText('Open / accessible 24 hours') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Opens at') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText('Staff contact from (optional)') as HTMLInputElement).value).toBe('09:00');
    fireEvent.click(screen.getByLabelText('Open / accessible 24 hours'));
    expect((screen.getByLabelText('Opens at') as HTMLInputElement).disabled).toBe(false);
  });
  it('loads complex schedules unchanged instead of coercing them to daily hours', () => {
    const value = { mon: [['08:00','12:00'], ['14:00','20:00']] };
    render(<AmenityHoursEditor timezone="Asia/Bangkok" value={value} />);
    expect((screen.getByLabelText('Schedule format') as HTMLSelectElement).value).toBe('custom');
    expect(JSON.parse((screen.getByLabelText(/Custom opening hours/) as HTMLTextAreaElement).value)).toEqual(value);
  });
});

it('round trips existing end-of-day staff hours through valid HTML time values', () => {
  const value = { daily: [['08:00','24:00']], staffContact: [['09:00','24:00']], timezone: 'Asia/Bangkok' };
  const { container } = render(<form><AmenityHoursEditor timezone="Asia/Bangkok" value={value} /></form>);
  expect((screen.getByLabelText('Staff contact until (optional)') as HTMLInputElement).value).toBe('00:00');
  expect(amenityHoursFromForm(new FormData(container.querySelector('form')!), value)).toEqual(value);
});
