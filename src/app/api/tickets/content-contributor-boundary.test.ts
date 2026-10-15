import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const state = vi.hoisted(() => ({
  user: {identityId: 'person', isAdmin: false, roles: [] as Array<{role: string; projectId: string | null; unitId: string | null}>},
  db: {booking: {findUnique: vi.fn()}, unit: {findUnique: vi.fn()}, serviceOrder: {findUnique: vi.fn()}},
  raise: vi.fn(),
}));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: async () => state.user }));
vi.mock('@/lib/prisma', () => ({ prisma: state.db }));
vi.mock('@/modules/comms', () => ({raiseTicket: state.raise, getReporterTickets: vi.fn()}));
vi.mock('@/modules/comms/standalone-ticket-access', () => ({ orderResponsibleOrganization: () => 'support-org' }));
vi.mock('@/app/libs/errorHandler', async () => {
  const { NextResponse } = await import('next/server');
  return {createPublicError: (message: string, statusCode: number) => Object.assign(new Error(message), {statusCode}),
    handleError: (error: {message: string; statusCode?: number}) => NextResponse.json({error: error.message}, {status: error.statusCode ?? 500})};
});
import { POST } from './route';
const grant = (unitId: string | null = null, role = 'content_contributor') => ({role, projectId: 'project-a', unitId});
const request = (changes: Record<string, unknown> = {}) => new NextRequest('http://localhost/api/tickets', {
  method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({projectId: 'project-a', unitId: 'unit-b', categoryKey: 'maintenance', title: 'Request', ...changes}),
});
beforeEach(() => {
  vi.clearAllMocks(); state.user.roles = [grant()]; state.user.isAdmin = false;
  state.db.unit.findUnique.mockResolvedValue({ownerIdentityId: 'someone-else'});
  state.db.booking.findUnique.mockResolvedValue(null); state.db.serviceOrder.findUnique.mockResolvedValue(null);
  state.raise.mockResolvedValue({id: 'ticket', threadId: 'thread'});
});
describe('content contributor cannot establish a property ticket relationship', () => {
  it.each([null, 'unit-a', 'unit-b'])('denies contributor-only grant on %s for property support', async unitId => {
    state.user.roles = [grant(unitId)];
    expect((await POST(request())).status).toBe(403);
    expect(state.raise).not.toHaveBeenCalled();
  });
  it('denies another project with contributor-only access', async () => {
    expect((await POST(request({projectId: 'project-b'}))).status).toBe(403);
    expect(state.raise).not.toHaveBeenCalled();
  });
  it('preserves the same identity’s independent booking relationship', async () => {
    state.db.booking.findUnique.mockResolvedValue({guestIdentityId: 'person', projectId: 'project-a'});
    expect((await POST(request({bookingId: 'own-booking'}))).status).toBe(201);
    expect(state.raise).toHaveBeenCalledWith(state.db, expect.objectContaining({raisedByIdentityId: 'person', raisedByRole: 'guest'}));
  });
  it('preserves independently verified unit ownership', async () => {
    state.db.unit.findUnique.mockResolvedValue({ownerIdentityId: 'person'});
    expect((await POST(request())).status).toBe(201);
    expect(state.raise).toHaveBeenCalledWith(state.db, expect.objectContaining({raisedByRole: 'owner', unitId: 'unit-b'}));
  });
  it('preserves a separate legitimate resident role', async () => {
    state.user.roles.push(grant(null, 'resident'));
    expect((await POST(request())).status).toBe(201);
    expect(state.raise).toHaveBeenCalledWith(state.db, expect.objectContaining({raisedByRole: 'resident'}));
  });
  it('preserves support for the same identity’s standalone order', async () => {
    state.db.serviceOrder.findUnique.mockResolvedValue({project_id: null, unit_id: null, booking_id: null, orderer_identity_id: 'person', service_context: {}});
    expect((await POST(request({projectId: undefined, unitId: undefined, serviceOrderId: 'own-order'}))).status).toBe(201);
    expect(state.raise).toHaveBeenCalledWith(state.db, expect.objectContaining({projectId: null, serviceOrderId: 'own-order'}));
  });
});
