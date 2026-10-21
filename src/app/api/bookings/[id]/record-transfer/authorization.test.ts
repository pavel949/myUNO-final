import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const { db, record } = vi.hoisted(() => ({ db: {
  identity: { findUnique: vi.fn() }, roleAssignment: { findMany: vi.fn() },
  projectStaffPermission: { findUnique: vi.fn() }, booking: { findUnique: vi.fn() },
}, record: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: db }));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: async () => ({ identityId: 'staff', isAdmin: false }) }));
vi.mock('@/modules/finance', () => ({ recordBankTransfer: record }));
vi.mock('@/modules/audit', () => ({ logAudit: vi.fn() }));
import { POST } from './route';
const scope = { id: 'booking', projectId: 'project', unitId: 'unit', guestIdentityId: 'guest' };
const role = { role: 'staff_ops', scopeType: 'project', projectId: 'project', unitId: null, status: 'active' };
const request = () => new NextRequest('http://localhost/api/bookings/booking/record-transfer', { method: 'POST', body: JSON.stringify({ amountThb: 10000, bankReference: 'local-test' }) });
describe('bank transfer receipt finance authority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.identity.findUnique.mockResolvedValue({ id: 'staff', status: 'active', isAdmin: false, roleAssignments: [role] });
    db.roleAssignment.findMany.mockResolvedValue([role]);
    db.booking.findUnique.mockResolvedValue(scope);
    record.mockResolvedValue({ id: 'payment', status: 'succeeded', receiptRef: 'local-test' });
  });
  it.each([[], ['housekeeping'], ['reservations']].map(departments => ({ departments })))('denies staff without finance department: $departments', async ({ departments }) => {
    db.projectStaffPermission.findUnique.mockResolvedValue({ departments });
    expect((await POST(request(), { params: Promise.resolve({ id: 'booking' }) })).status).toBe(403);
    expect(record).not.toHaveBeenCalled();
  });
  it('allows finance staff and passes a current authority check into the locked writer', async () => {
    db.projectStaffPermission.findUnique.mockResolvedValue({ departments: ['finance'] });
    expect((await POST(request(), { params: Promise.resolve({ id: 'booking' }) })).status).toBe(201);
    const command = record.mock.calls[0][1];
    expect(command).toMatchObject({ bookingId: 'booking', confirmedByIdentityId: 'staff' });
    db.projectStaffPermission.findUnique.mockResolvedValue({ departments: [] });
    expect(await command.authorizeBooking(db, scope)).toBe(false);
  });
  it('maps a revocation rejected inside the transaction to forbidden', async () => {
    db.projectStaffPermission.findUnique.mockResolvedValue({ departments: ['finance'] });
    record.mockRejectedValue(Object.assign(new Error('Booking authority changed'), { code: 'BOOKING_FORBIDDEN' }));
    expect((await POST(request(), { params: Promise.resolve({ id: 'booking' }) })).status).toBe(403);
  });
});
