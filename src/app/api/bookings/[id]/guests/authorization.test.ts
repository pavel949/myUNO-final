import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const { db, session, capture } = vi.hoisted(() => ({
  db: { booking: { findUnique: vi.fn() }, bookingGuest: { findMany: vi.fn() }, projectStaffPermission: { findUnique: vi.fn() } },
  session: { identityId: 'staff', isAdmin: false, roles: [{ role: 'staff_ops', projectId: 'project', unitId: null }] },
  capture: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({ prisma: db }));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: async () => session }));
vi.mock('@/modules/ops', () => ({ safeDecrypt: (value: string) => value, capturePassportData: capture, createTm30Filing: vi.fn(), encryptGuestPii: vi.fn() }));
import { GET, POST } from './route';
import { POST as verify } from '@/app/api/bookings/[id]/verify-passports/route';
const params = { params: Promise.resolve({ id: 'booking' }) };
const request = (body: unknown) => new NextRequest('http://localhost/api/bookings/booking/guests', { method: 'POST', body: JSON.stringify(body) });
describe('party document routes enforce configured staff departments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.booking.findUnique.mockResolvedValue({ id: 'booking', projectId: 'project', unitId: 'unit', guestIdentityId: 'guest', verificationStatus: 'pending', unit: { ownerIdentityId: 'owner' } });
    db.projectStaffPermission.findUnique.mockResolvedValue({ departments: [] });
    db.bookingGuest.findMany.mockResolvedValue([{ id: 'party', fullName: 'Private Guest', dateOfBirth: '1980-01-01', nationality: 'RU', passportNumber: 'encrypted', isLead: true }]);
  });
  it('denies PII reads before loading party data', async () => {
    expect((await GET(new NextRequest('http://localhost/api/bookings/booking/guests'), params)).status).toBe(404);
    expect(db.bookingGuest.findMany).not.toHaveBeenCalled();
  });
  it('denies adding passport records before processing PII', async () => {
    expect((await POST(request({ fullName: 'Private Guest', nationality: 'RU', passportNumber: 'private' }), params)).status).toBe(404);
    expect(capture).not.toHaveBeenCalled();
  });
  it('denies passport verification before capturing documents', async () => {
    expect((await verify(request([{ bookingGuestId: 'party', passportNumber: 'private' }]), params)).status).toBe(403);
    expect(capture).not.toHaveBeenCalled();
  });
  it('retains party reads for authorized front-desk staff', async () => {
    db.projectStaffPermission.findUnique.mockResolvedValue({ departments: ['front_desk'] });
    const response = await GET(new NextRequest('http://localhost/api/bookings/booking/guests'), params);
    expect(response.status).toBe(200);
    expect((await response.json()).guests[0]).toMatchObject({ fullName: 'Private Guest', dateOfBirth: '1980-01-01', passportProvided: true });
  });
});
