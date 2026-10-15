import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import EmergencyHelpPage from './page';
import { THAILAND_EMERGENCY_CONTACTS } from './contacts';
vi.mock('@/lib/i18n', () => ({ getLabels: async (labels: Record<string, string>) => labels }));
vi.mock('@/components/premium/StitchPage', () => ({ StitchMain: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock('@/modules/destinations', () => ({ getDestination: () => ({ countryCode: 'TH' }) }));

describe('public emergency guidance', () => {
  it('exposes immediate emergency calling without account or booking prerequisites', async () => {
    render(await EmergencyHelpPage());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Emergency help in Thailand');
    for (const contact of THAILAND_EMERGENCY_CONTACTS) {
      expect(screen.getByRole('link', { name: contact.phone })).toHaveAttribute('href', `tel:${contact.phone}`);
    }
    expect(screen.getAllByRole('link', { name: 'Official source' })).toHaveLength(4);
    expect(screen.getByRole('link', { name: /Open my trips/ })).toHaveAttribute('href', '/trips');
    expect(screen.getByText(/Do not wait for a myUNO message/)).toBeInTheDocument();
  });
  it('binds each emergency number to a recorded government source', () => {
    expect(THAILAND_EMERGENCY_CONTACTS.map(row => row.phone)).toEqual(['1669', '191', '199', '1155']);
    expect(THAILAND_EMERGENCY_CONTACTS.every(row => ['thailand.go.th', 'www.gov.uk'].includes(new URL(row.source).hostname))).toBe(true);
  });
});
