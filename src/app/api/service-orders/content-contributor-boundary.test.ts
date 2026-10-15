import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const state = vi.hoisted(() => ({
  user: { identityId: 'person', isAdmin: false, roles: [] as Array<{role: string; projectId: string | null; unitId: string | null}> },
  db: { service: { findUnique: vi.fn() }, project: { findUnique: vi.fn(), findMany: vi.fn() },
    unit: { findUnique: vi.fn() }, booking: { findUnique: vi.fn() } },
  create: vi.fn(),
}));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: async () => state.user }));
vi.mock('@/lib/prisma', () => ({ prisma: state.db }));
vi.mock('@/modules/services', () => ({ createServiceOrder: state.create }));
vi.mock('@/app/libs/serviceOrderSerializer', () => ({ serializeOrder: (value: unknown) => value }));
vi.mock('@/app/libs/errorHandler', async () => {
  const { NextResponse } = await import('next/server');
  return { createPublicError: (message: string, statusCode: number) => Object.assign(new Error(message), {statusCode}),
    handleError: (error: {message: string; statusCode?: number}) => NextResponse.json({error: error.message}, {status: error.statusCode ?? 500}) };
});
import { POST } from './route';

const grant = (unitId: string | null = null, role = 'content_contributor') => ({role, projectId: 'project-a', unitId});
const request = (changes: Record<string, unknown> = {}) => new NextRequest('http://localhost/api/service-orders', {
  method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({
    serviceId: 'service', projectId: 'project-a', unitId: 'unit-b', scheduledStart: '2099-01-01T12:00:00Z', ...changes,
  }),
});
beforeEach(() => {
  vi.clearAllMocks(); state.user.isAdmin = false; state.user.roles = [grant()];
  state.db.service.findUnique.mockResolvedValue({id: 'service', status: 'active', priceModel: 'fixed', provider: {status: 'active'}, durationMin: 60});
  state.db.project.findUnique.mockImplementation(async ({where}) => ({id: where.id}));
  state.db.unit.findUnique.mockResolvedValue({projectId: 'project-a'});
  state.db.booking.findUnique.mockResolvedValue(null);
  state.create.mockResolvedValue({id: 'order'});
});
describe('content contributor cannot establish a property service-order relationship', () => {
  it.each([null, 'unit-a', 'unit-b'])('denies contributor-only grant on %s, including same-project sibling units', async unitId => {
    state.user.roles = [grant(unitId)];
    expect((await POST(request())).status).toBe(404);
    expect(state.create).not.toHaveBeenCalled();
  });
  it('denies another project even with a contributor project grant', async () => {
    state.db.unit.findUnique.mockResolvedValue({projectId: 'project-b'});
    expect((await POST(request({projectId: 'project-b'}))).status).toBe(404);
    expect(state.create).not.toHaveBeenCalled();
  });
  it('preserves an independently verified guest booking for the same identity', async () => {
    state.db.booking.findUnique.mockResolvedValue({guestIdentityId: 'person', projectId: 'project-a', unitId: 'unit-b'});
    expect((await POST(request({bookingId: 'own-booking'}))).status).toBe(201);
    expect(state.create).toHaveBeenCalledWith(state.db, expect.objectContaining({bookingId: 'own-booking', unitId: 'unit-b', ordererIdentityId: 'person'}));
  });
  it('preserves a separate owner role on the exact requested unit', async () => {
    state.user.roles.push(grant('unit-b', 'owner'));
    expect((await POST(request())).status).toBe(201);
    expect(state.create).toHaveBeenCalledTimes(1);
  });
  it('preserves ordinary standalone-customer ordering without a property relationship', async () => {
    expect((await POST(request({projectId: undefined, unitId: undefined, serviceContext: {areaId: 'area', address: 'Customer address'}}))).status).toBe(201);
    expect(state.create).toHaveBeenCalledWith(state.db, expect.objectContaining({projectId: null, serviceContext: {areaId: 'area', address: 'Customer address'}}));
  });
  it('still rejects somebody else’s booking', async () => {
    state.db.booking.findUnique.mockResolvedValue({guestIdentityId: 'someone-else', projectId: 'project-a', unitId: 'unit-b'});
    expect((await POST(request({bookingId: 'foreign-booking'}))).status).toBe(404);
    expect(state.create).not.toHaveBeenCalled();
  });
});
