import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ShareStayOffer } from './ShareStayOffer';
import { stayUxDefaults } from '@/modules/content/stay-ux.seed';

afterEach(() => vi.restoreAllMocks());
it('shares dated server total and public intent without leaking arbitrary URL parameters', async () => {
  window.history.replaceState({}, '', '/units/home?adults=2&children=1&token=private&bookingId=private');
  const share = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'share', { configurable: true, value: share });
  render(<ShareStayOffer name="Home" unitId="home" startDate="2027-01-10" endDate="2027-01-13" guests={3} totalSatang={123456} copy={stayUxDefaults('en')} />);
  fireEvent.click(screen.getByRole('button', { name: 'Share offer' }));
  await waitFor(() => expect(share).toHaveBeenCalledOnce());
  const text = share.mock.calls[0][0].text;
  expect(text).toContain('2027-01-10 → 2027-01-13');
  expect(text).toContain('1,234.56');
  expect(text).toContain('adults=2');
  expect(text).not.toContain('token=');
  expect(text).not.toContain('bookingId=');
  expect(text).toContain('checked again before booking');
});

it('never invents a total when there is no available quote', () => {
  const open = vi.spyOn(window, 'open').mockReturnValue(null);
  render(<ShareStayOffer name="Home" unitId="home" guests={2} copy={stayUxDefaults('en')} />);
  fireEvent.click(screen.getByRole('button', { name: 'Share on WhatsApp' }));
  const url = new URL(open.mock.calls[0][0] as string);
  expect(url.origin).toBe('https://wa.me');
  expect(url.searchParams.get('text')).not.toContain('Total for your stay:');
});
