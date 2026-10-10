import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ unit: vi.fn(), content: vi.fn(), discovery: vi.fn(), booking: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { unit: { findUnique: mocks.unit }, contentKey: { findUnique: mocks.content } } }));
vi.mock('./public-discovery', () => ({ listPublicDiscoveryUnits: mocks.discovery }));
vi.mock('./public.service', () => ({ getPublicUnitById: mocks.booking }));
import { getUnitPublicationReadiness } from './unit-publication-readiness';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.unit.mockResolvedValue({ id: 'villa', descriptionKey: null, sizeSqm: null, grossAreaSqm: null, project: { status: 'live' }, sleepingSpaces: [] });
  mocks.discovery.mockResolvedValue([{ id: 'villa', videoUrls: [] }]);
  mocks.booking.mockResolvedValue(null);
});
describe('actual publication capability, independent of activation completeness', () => {
  it('keeps an imported public draft inquiry-ready with all optional details missing', async () => {
    expect(await getUnitPublicationReadiness('villa')).toEqual({
      unitId: 'villa', published: true, canReceiveInquiry: true, bookingFlowAvailable: false,
      detailsToAdd: ['description', 'sleeping', 'video', 'measurements'],
    });
    expect(mocks.discovery).toHaveBeenCalledWith({ unitId: 'villa' });
    expect(mocks.booking).toHaveBeenCalledWith('villa');
  });
  it.each(['arbitrary draft', 'suspended', 'offboarded', 'private project'])('does not infer publication for %s when the shared public readers exclude it', async () => {
    mocks.discovery.mockResolvedValue([]);
    expect(await getUnitPublicationReadiness('villa')).toMatchObject({ published: false, canReceiveInquiry: false, bookingFlowAvailable: false });
  });
  it('does not mistake draft-project visibility for a working inquiry route', async () => {
    mocks.unit.mockResolvedValue({ id: 'villa', descriptionKey: null, grossAreaSqm: null, sizeSqm: null, project: { status: 'draft' }, sleepingSpaces: [] });
    expect(await getUnitPublicationReadiness('villa')).toMatchObject({ published: true, canReceiveInquiry: false });
  });
  it('uses the booking reader, never a status or instantBook guess', async () => {
    mocks.booking.mockResolvedValue({ id: 'villa', bookable: true, instantBook: false });
    expect(await getUnitPublicationReadiness('villa')).toMatchObject({ bookingFlowAvailable: true });
  });
  it('only accepts the exact requested identity from either public reader', async () => {
    mocks.discovery.mockResolvedValue([{ id: 'other', videoUrls: [] }]);
    mocks.booking.mockResolvedValue({ id: 'other', bookable: true });
    expect(await getUnitPublicationReadiness('villa')).toMatchObject({ published: false, bookingFlowAvailable: false });
  });
  it('completed details do not grant publication or booking capability', async () => {
    mocks.unit.mockResolvedValue({ id: 'villa', descriptionKey: 'unit.villa.description', grossAreaSqm: 120, project: { status: 'live' }, sleepingSpaces: [{ beds: [{ count: 2 }] }] });
    mocks.content.mockResolvedValue({ translations: [{ status: 'ok', value: 'Reviewed' }] });
    mocks.discovery.mockResolvedValue([]);
    expect(await getUnitPublicationReadiness('villa')).toMatchObject({ published: false, bookingFlowAvailable: false, detailsToAdd: ['video'] });
  });
  it('unreviewed copy and empty bed rows remain details to add, without blocking visibility', async () => {
    mocks.unit.mockResolvedValue({ id: 'villa', descriptionKey: 'key', grossAreaSqm: null, sizeSqm: 100, project: { status: 'live' }, sleepingSpaces: [{ beds: [{ count: 0 }] }] });
    mocks.content.mockResolvedValue({ translations: [{ status: 'needs_review', value: 'Draft' }] });
    expect(await getUnitPublicationReadiness('villa')).toMatchObject({ published: true, detailsToAdd: ['description', 'sleeping', 'video'] });
  });
  it('read failures are errors, never a false unpublished/disabled result', async () => {
    mocks.discovery.mockRejectedValue(new Error('unavailable'));
    await expect(getUnitPublicationReadiness('villa')).rejects.toThrow('unavailable');
  });
  it('returns null for an unknown unit', async () => {
    mocks.unit.mockResolvedValue(null);
    expect(await getUnitPublicationReadiness('missing')).toBeNull();
    expect(mocks.discovery).not.toHaveBeenCalled();
  });
});
