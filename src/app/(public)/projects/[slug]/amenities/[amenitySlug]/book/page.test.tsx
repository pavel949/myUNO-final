import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ resource: vi.fn(), user: vi.fn() }));
vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('not-found'); },
  redirect: (url: string) => { throw new Error(`redirect:${url}`); },
}));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: mocks.user }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/modules/projects', () => ({ getPublicProjectAmenityBySlug: mocks.resource }));
vi.mock('@/lib/i18n', () => ({ getRequestLocale: () => 'en', getLabels: async (labels: unknown) => labels }));
vi.mock('@/components/projects/AmenityBookingClient', () => ({ default: () => null }));
import Page from './page';
const params = { slug: 'complex', amenitySlug: 'pool' };
const live = () => ({ project: { status: 'live', slug: 'complex' }, amenity: {
  id: 'pool', slug: 'pool', name: 'Pool', bookingRequired: true, bookingMode: 'time_slot', reservationConfig: null,
} });
beforeEach(() => { vi.clearAllMocks(); mocks.resource.mockResolvedValue(live()); mocks.user.mockResolvedValue(null); });

describe('amenity booking page eligibility before authentication', () => {
  it.each(['draft', 'archived'])('rejects %s before any login redirect, even for an admin', async status => {
    const resource = live(); resource.project.status = status; mocks.resource.mockResolvedValue(resource);
    mocks.user.mockResolvedValue({ identityId: 'admin', isAdmin: true });
    await expect(Page({ params })).rejects.toThrow('not-found');
    expect(mocks.user).not.toHaveBeenCalled();
  });
  it('rejects a missing or unpublished amenity before login', async () => {
    mocks.resource.mockResolvedValue(null);
    await expect(Page({ params })).rejects.toThrow('not-found');
    expect(mocks.user).not.toHaveBeenCalled();
  });
  it.each(['none', 'other', 'external'])('rejects descriptive booking mode %s', async bookingMode => {
    const resource = live(); resource.amenity.bookingMode = bookingMode; mocks.resource.mockResolvedValue(resource);
    await expect(Page({ params })).rejects.toThrow('not-found');
    expect(mocks.user).not.toHaveBeenCalled();
  });
  it('preserves login and the return path for an eligible live amenity', async () => {
    const next = '/projects/complex/amenities/pool/book?bookingId=stay%26one';
    await expect(Page({ params, searchParams: { bookingId: 'stay&one' } })).rejects.toThrow(`redirect:/login?next=${encodeURIComponent(next)}`);
  });
  it('renders the booking client for an authenticated live resource', async () => {
    mocks.user.mockResolvedValue({ identityId: 'guest', isAdmin: false });
    const page = await Page({ params });
    expect(page.type).toBe('main');
  });
});
