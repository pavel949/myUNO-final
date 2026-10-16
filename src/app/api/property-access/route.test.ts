import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';
const h = vi.hoisted(() => ({ user: vi.fn(), workspace: vi.fn(), units: vi.fn(), recipient: vi.fn(), grant: vi.fn(), revoke: vi.fn() }));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: h.user }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/modules/core/property-capability-directory', () => ({ propertyDelegationWorkspace: h.workspace, propertyDelegationUnits: h.units, resolvePropertyDelegationRecipient: h.recipient }));
vi.mock('@/modules/core/property-capability-grants', () => ({ grantPropertyCapability: h.grant, revokePropertyCapability: h.revoke }));
const body = () => ({ action: 'grant', email: 'employee@example.test', role: 'pricing_editor', parentGrantId: 'root', scopeType: 'unit', projectId: 'p', unitId: 'a' });
const request = (data: unknown) => new Request('http://localhost/api/property-access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
beforeEach(() => { vi.clearAllMocks(); h.user.mockResolvedValue({ identityId: 'manager' }); h.workspace.mockResolvedValue({ grants: [], assignments: [] });
  h.units.mockResolvedValue({ units: [], hasMore: false }); h.recipient.mockResolvedValue('employee'); h.grant.mockResolvedValue({ grant: { id: 'child', status: 'active', privateField: 'not in response' }, alreadyGranted: false }); h.revoke.mockResolvedValue({ grant: { id: 'child', status: 'revoked' }, alreadyRevoked: false }); });
describe('manager property access API', () => {
  it('uses authenticated actor and independently checked exact recipient/scope', async () => {
    const response = await POST(request(body())); expect(response.status).toBe(200);
    expect(h.recipient).toHaveBeenCalledWith({}, 'manager', 'pricing_editor', 'root', 'employee@example.test');
    expect(h.grant).toHaveBeenCalledWith({}, 'manager', { identityId: 'employee', role: 'pricing_editor', parentGrantId: 'root', scopeType: 'unit', projectId: 'p', unitId: 'a', expiresAt: undefined, expectedUpdatedAt: undefined, canDelegate: false });
    expect(await response.json()).toEqual({ id: 'child', status: 'active', alreadyGranted: false });
  });
  it.each([{ identityId: 'victim' }, { actorIdentityId: 'admin' }, { canDelegate: true }, { organizationId: 'org' }, { isAdmin: true }, { role: 'staff_ops' }])('rejects mass assignment or unrelated role %j', async extra => {
    expect((await POST(request({ ...body(), ...extra }))).status).toBe(400); expect(h.recipient).not.toHaveBeenCalled(); expect(h.grant).not.toHaveBeenCalled();
  });
  it('permits only explicit revoke payload', async () => {
    expect((await POST(request({ action: 'revoke', roleAssignmentId: 'child' }))).status).toBe(200);
    expect(h.revoke).toHaveBeenCalledWith({}, 'manager', 'child');
    h.revoke.mockClear(); expect((await POST(request({ action: 'revoke', roleAssignmentId: 'child', actorIdentityId: 'admin' }))).status).toBe(400); expect(h.revoke).not.toHaveBeenCalled();
  });
  it('never serves directory data or writes without a session', async () => {
    h.user.mockResolvedValue(null); expect((await GET(new Request('http://localhost/api/property-access'))).status).toBe(401);
    expect((await POST(request(body()))).status).toBe(401); expect(h.workspace).not.toHaveBeenCalled(); expect(h.grant).not.toHaveBeenCalled();
  });
  it('routes scoped unit search to the bounded service without a global people list', async () => {
    expect((await GET(new Request('http://localhost/api/property-access?parentGrantId=root&role=pricing_editor&q=A'))).status).toBe(200);
    expect(h.units).toHaveBeenCalledWith({}, 'manager', { role: 'pricing_editor', parentGrantId: 'root', query: 'A' }); expect(h.workspace).not.toHaveBeenCalled();
  });
});
