import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';
const h = vi.hoisted(() => ({ user: vi.fn(), identity: vi.fn(), can: vi.fn(), invite: vi.fn(), claim: vi.fn(), config: vi.fn(), email: vi.fn(), audit: vi.fn() }));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: h.user }));
vi.mock('@/lib/prisma', () => ({ prisma: { identity: { findUnique: h.identity } } }));
vi.mock('@/modules/core', () => ({ can: h.can, people: { inviteIdentity: h.invite, generateClaimLink: h.claim } }));
vi.mock('@/modules/config', () => ({ getConfig: h.config }));
vi.mock('@/modules/auth', () => ({ sendEmail: h.email }));
vi.mock('@/modules/audit', () => ({ logAudit: h.audit }));
const person = { id: 'employee', email: 'employee@example.test', firstName: 'Synthetic <Employee>', lastName: 'Test', status: 'invited' };
const request = (extra = {}) => new NextRequest('http://localhost/api/admin/people/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: person.email, firstName: person.firstName, lastName: person.lastName, destination: 'property', ...extra }) });
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('RESEND_API_KEY', ''); vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3000');
  h.user.mockResolvedValue({ identityId: 'founder' }); h.identity.mockResolvedValue({ id: 'founder', status: 'active', isAdmin: true });
  h.can.mockResolvedValue(true); h.invite.mockResolvedValue({ identity: person, created: true, alreadyActive: false });
  h.claim.mockResolvedValue('synthetic-single-use-proof'); h.config.mockResolvedValue(null); h.email.mockResolvedValue(undefined); h.audit.mockResolvedValue(undefined); });
afterEach(() => vi.unstubAllEnvs());
describe('founder employee invitation boundary and truthful delivery state', () => {
  it('returns the employee claim destination only to the authorized inviter and reports unavailable email accurately', async () => {
    const res = await POST(request()); expect(res.status).toBe(201); const result = await res.json();
    expect(result).toMatchObject({ emailed: false, emailStatus: 'unavailable', claimUrl: 'http://localhost:3000/auth/claim?token=synthetic-single-use-proof&next=%2Fproperty' });
    expect(h.email).not.toHaveBeenCalled();
    expect(h.audit).toHaveBeenCalledWith({ actorIdentityId: 'founder', action: 'people:invited', entityType: 'Identity', entityId: 'employee', data: { emailed: false } });
    expect(JSON.stringify(h.audit.mock.calls)).not.toContain(person.email); expect(JSON.stringify(h.audit.mock.calls)).not.toContain('synthetic-single-use-proof');
  });
  it('calls provider acceptance accepted, never delivered, and escapes the name in HTML', async () => {
    vi.stubEnv('RESEND_API_KEY', 'synthetic-unit-test-placeholder');
    const result = await (await POST(request())).json(); expect(result.emailStatus).toBe('accepted'); expect(result.delivered).toBeUndefined();
    expect(h.email).toHaveBeenCalledWith(expect.objectContaining({ to: person.email, html: expect.stringContaining('Synthetic &lt;Employee&gt;') }));
  });
  it('keeps the one-time fallback available after provider failure', async () => {
    vi.stubEnv('RESEND_API_KEY', 'synthetic-unit-test-placeholder'); h.email.mockRejectedValue(new Error('provider rejected'));
    expect(await (await POST(request())).json()).toMatchObject({ emailed: false, emailStatus: 'unavailable', claimUrl: expect.any(String) });
  });
  it('does not send claim links or reset passwords for an existing active account', async () => {
    h.invite.mockResolvedValue({ identity: { ...person, status: 'active' }, created: false, alreadyActive: true });
    expect(await (await POST(request())).json()).toMatchObject({ alreadyActive: true, claimUrl: null });
    expect(h.claim).not.toHaveBeenCalled(); expect(h.email).not.toHaveBeenCalled();
  });
  it.each([null, { identityId: 'employee' }])('does not disclose a link without inviter authorization %j', async user => {
    h.user.mockResolvedValue(user); h.can.mockResolvedValue(false);
    expect([401, 403]).toContain((await POST(request())).status); expect(h.invite).not.toHaveBeenCalled(); expect(h.claim).not.toHaveBeenCalled();
  });
  it.each([{ destination: 'https://external.example' }, { role: 'staff_ops' }, { isAdmin: true }])('rejects unauthorized destination or extra assignment fields %j', async extra => {
    expect((await POST(request(extra))).status).toBe(400); expect(h.invite).not.toHaveBeenCalled();
  });
});
