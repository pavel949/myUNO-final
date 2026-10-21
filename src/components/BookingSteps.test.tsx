import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { BookingSteps } from './BookingSteps';

const labels = { aria: 'Booking progress', review: 'Review', pay: 'Pay', confirmed: 'Confirmed', current: 'current step' };

it('marks only the current step and lists all three in order', () => {
  render(<BookingSteps current={2} labels={labels} />);
  const nav = screen.getByRole('navigation', { name: 'Booking progress' });
  const items = nav.querySelectorAll('li');
  expect(Array.from(items).map((li) => li.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
    '✓Review',
    '2Pay — current step',
    '3Confirmed',
  ]);
  expect(nav.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
  expect(items[1].getAttribute('aria-current')).toBe('step');
});


it('places property approval before payment for request-only stays', () => {
  render(<BookingSteps current={1} labels={labels} approvalLabel="Property approval" />);
  const items = screen.getByRole('navigation', { name: labels.aria }).querySelectorAll('li');
  expect(Array.from(items).map(item => item.textContent)).toEqual([
    '1Review — current step', '2Property approval', '3Pay', '4Confirmed',
  ]);
  expect(items[0]).toHaveAttribute('aria-current', 'step');
});
