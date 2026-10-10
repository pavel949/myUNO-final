import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UNIT_PUBLICATION_KEYS } from '@/modules/content/unit-publication.seed';
const mocks = vi.hoisted(() => ({ report: vi.fn(), locale: 'ru' }));
vi.mock('@/modules/projects/unit-publication-readiness', () => ({ getUnitPublicationReadiness: mocks.report }));
vi.mock('@/lib/i18n', () => ({ getLabels: vi.fn(async (keys, _locale, drafts) => Object.fromEntries(Object.keys(keys).map(key => [key, drafts[key][mocks.locale]]))) }));
import UnitPublicationPanel from './UnitPublicationPanel';
beforeEach(() => {
  mocks.report.mockResolvedValue({ unitId: 'villa', published: true, canReceiveInquiry: true, bookingFlowAvailable: false, detailsToAdd: ['description', 'sleeping', 'video', 'measurements'] });
});
describe('operator publication labels', () => {
  it.each(['en', 'ru', 'th', 'zh'] as const)('renders complete %s copy without changing review status', async locale => {
    mocks.locale = locale;
    render(await UnitPublicationPanel({ unitId: 'villa' }));
    const copy = (suffix: string) => UNIT_PUBLICATION_KEYS.find(row => row.key.endsWith(`.${suffix}`))![locale];
    expect(screen.getByText(copy('inquiries'))).toBeInTheDocument();
    expect(screen.getByText(copy('booking_disabled'))).toBeInTheDocument();
    expect(screen.getByText(copy('sleeping'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: new RegExp(copy('view')) })).toHaveAttribute('href', '/units/villa');
    expect(UNIT_PUBLICATION_KEYS.every(row => row.status === 'needs_review' && row.en && row.ru && row.th && row.zh)).toBe(true);
  });
  it('offers no public link for a private unit', async () => {
    mocks.report.mockResolvedValue({ published: false, canReceiveInquiry: false, bookingFlowAvailable: false, detailsToAdd: [] });
    render(await UnitPublicationPanel({ unitId: 'villa' }));
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
  it('shows an explicit unavailable state on read error', async () => {
    mocks.locale = 'en'; mocks.report.mockRejectedValue(new Error('database unavailable'));
    render(await UnitPublicationPanel({ unitId: 'villa' }));
    expect(screen.getByRole('status')).toHaveTextContent('Publication status could not be checked');
    expect(screen.queryByText('Not publicly visible')).not.toBeInTheDocument();
    expect(screen.queryByText('Booking not enabled')).not.toBeInTheDocument();
  });
});
