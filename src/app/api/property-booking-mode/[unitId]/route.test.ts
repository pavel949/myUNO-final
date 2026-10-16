import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST, PUT } from './route';
import { PropertyCapabilityError } from '@/modules/core/property-capability-access';
const h = vi.hoisted(() => ({ user: vi.fn(), preview: vi.fn(), apply: vi.fn() }));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: h.user }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/modules/projects/property-booking-mode', () => ({ previewPropertyBookingMode: h.preview, applyPropertyBookingMode: h.apply }));
const request = (body: unknown) => new Request('http://localhost/api/property-booking-mode/a', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const ctx = { params: { unitId: 'a' } };
beforeEach(() => { vi.clearAllMocks(); h.user.mockResolvedValue({ identityId: 'employee' }); h.preview.mockResolvedValue({ units: [{ id: 'a' }] }); h.apply.mockResolvedValue({ updated: 1, instantBook: false }); });
describe('booking mode API narrow inputs', () => {
  it('uses session actor and path target for independent preview and apply', async () => {
    expect((await POST(request({ scope: 'unit', instantBook: false }), ctx)).status).toBe(200);
    expect(h.preview).toHaveBeenCalledWith({}, { actorIdentityId: 'employee', unitId: 'a', scope: 'unit', instantBook: false });
    expect((await PUT(request({ scope: 'unit', instantBook: false, baseline: 'baseline', requestId: 'request' }), ctx)).status).toBe(200);
    expect(h.apply).toHaveBeenCalledWith({}, { actorIdentityId: 'employee', unitId: 'a', scope: 'unit', instantBook: false, baseline: 'baseline', requestId: 'request' });
  });
  it.each([{ actorIdentityId: 'admin' }, { unitId: 'foreign' }, { price: 1 }, { status: 'live' }, { ownerIdentityId: 'employee' }, { scope: 'project' }, { instantBook: 'true' }])('rejects extra or malformed preview fields %j', async extra => {
    expect((await POST(request({ scope: 'unit', instantBook: false, ...extra }), ctx)).status).toBe(400); expect(h.preview).not.toHaveBeenCalled();
  });
  it('requires explicit preview receipt on apply and never trusts a supplied target list', async () => {
    for (const body of [{ scope: 'unit', instantBook: false }, { scope: 'category', instantBook: true, baseline: 'b', requestId: 'r', unitIds: ['a'] }])
      expect((await PUT(request(body), ctx)).status).toBe(400);
    expect(h.apply).not.toHaveBeenCalled();
  });
  it.each([403, 409])('retains fresh access/conflict status %s', async status => {
    h.apply.mockRejectedValue(new PropertyCapabilityError('Current scope or baseline changed', status));
    expect((await PUT(request({ scope: 'unit', instantBook: false, baseline: 'b', requestId: 'r' }), ctx)).status).toBe(status);
  });
  it('fails closed without login and does not leak an unexpected internal error', async () => {
    h.user.mockResolvedValue(null); expect((await POST(request({ scope: 'unit', instantBook: false }), ctx)).status).toBe(401); expect(h.preview).not.toHaveBeenCalled();
    h.user.mockResolvedValue({ identityId: 'employee' }); h.preview.mockRejectedValue(new Error('private database detail'));
    const result = await POST(request({ scope: 'unit', instantBook: false }), ctx); expect(result.status).toBe(500);
    expect(await result.json()).toEqual({ error: 'Could not update booking mode' });
  });
});
