import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), useSearchParams: () => new URLSearchParams('inventoryCategoryId=cat&bedrooms=3&sort=price_asc') }));
vi.mock('./LocaleProvider', () => ({ useLocale: () => 'en' }));
vi.mock('./StayDatePicker', () => ({ StayDatePicker: () => <div>Dates</div> }));
import { SearchBar } from './SearchBar';
it('changing dates preserves category, filters, sorting and project scope', () => {
  render(<SearchBar projectId="project" initialStartDate="2026-11-10" initialEndDate="2026-11-20" labels={{ checkIn: 'In', checkOut: 'Out', adults: 'Adults', children: 'Children', submit: 'Search' }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Search' }));
  const query = new URL(push.mock.lastCall?.[0], 'https://example.test').searchParams;
  expect(query.get('inventoryCategoryId')).toBe('cat');
  expect(query.get('bedrooms')).toBe('3');
  expect(query.get('sort')).toBe('price_asc');
  expect(query.get('projectId')).toBe('project');
  expect(query.get('startDate')).toBe('2026-11-10');
});

it('guest counts use +/- steppers and are sent to search', () => {
  push.mockClear();
  render(<SearchBar initialAdults={2} labels={{ checkIn: 'In', checkOut: 'Out', adults: 'Adults', children: 'Children', submit: 'Search' }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Adults: more' }));
  fireEvent.click(screen.getByRole('button', { name: 'Children: more' }));
  fireEvent.click(screen.getByRole('button', { name: 'Children: more' }));
  fireEvent.click(screen.getByRole('button', { name: 'Children: fewer' }));
  fireEvent.click(screen.getByRole('button', { name: 'Search' }));
  const query = new URL(push.mock.lastCall?.[0], 'https://example.test').searchParams;
  expect(query.get('adults')).toBe('3');
  expect(query.get('children')).toBe('1');
});

it('keeps at least one adult', () => {
  render(<SearchBar initialAdults={1} labels={{ checkIn: 'In', checkOut: 'Out', adults: 'Adults', children: 'Children', submit: 'Search' }} />);
  expect(screen.getByRole('button', { name: 'Adults: fewer' })).toBeDisabled();
});
