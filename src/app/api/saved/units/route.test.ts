import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  user: { identityId: 'viewer' } as { identityId: string } | null,
  publicUnit: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), deleteMany: vi.fn(), lock: vi.fn(),
}));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: async () => mocks.user }));
vi.mock('@/modules/projects', () => ({ getPublicUnitById: mocks.publicUnit }));
vi.mock('@/lib/prisma', () => ({ prisma: {
  savedUnit: { findMany: mocks.findMany },
  $transaction: async (action: (tx: unknown) => unknown) => action({ $executeRaw: mocks.lock,
    savedUnit: { findFirst: mocks.findFirst, create: mocks.create, deleteMany: mocks.deleteMany } }),
} }));
import { GET, PUT } from './route';
const request = (body: unknown) => new Request('https://example.test/api/saved/units', { method: 'PUT', body: JSON.stringify(body) });
beforeEach(() => {
  vi.clearAllMocks(); mocks.user = { identityId: 'viewer' };
  mocks.findMany.mockResolvedValue([{ unitId: 'home' }]); mocks.publicUnit.mockResolvedValue({ id: 'home' });
  mocks.findFirst.mockResolvedValue(null); mocks.deleteMany.mockResolvedValue({ count: 1 });
});
describe('private shortlist boundary', () => {
  it('requires a session for both reads and writes', async () => {
    mocks.user = null;
    expect((await GET()).status).toBe(401);
    expect((await PUT(request({ unitId: 'home', saved: true }))).status).toBe(401);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('returns only own default-list IDs without public caching', async () => {
    const response = await GET();
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(mocks.findMany).toHaveBeenCalledWith({ where: { identityId: 'viewer', collection: null }, select: { unitId: true } });
    expect(await response.json()).toEqual({ unitIds: ['home'] });
  });
  it('rejects non-public units and malformed intent', async () => {
    mocks.publicUnit.mockResolvedValue(null);
    expect((await PUT(request({ unitId: 'private', saved: true }))).status).toBe(404);
    expect((await PUT(request({ unitId: 'private', saved: 'true' }))).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('ignores client identity and serializes duplicate saves', async () => {
    expect((await PUT(request({ unitId: 'home', saved: true, identityId: 'victim' }))).status).toBe(200);
    expect(mocks.lock).toHaveBeenCalledOnce();
    expect(mocks.create).toHaveBeenCalledWith({ data: { identityId: 'viewer', unitId: 'home', collection: null, note: undefined } });
    mocks.findFirst.mockResolvedValue({ id: 'existing' });
    await PUT(request({ unitId: 'home', saved: true }));
    expect(mocks.create).toHaveBeenCalledOnce();
  });
  it('removes only own default-list entry even after a home disappears', async () => {
    expect((await PUT(request({ unitId: 'home', saved: false }))).status).toBe(200);
    expect(mocks.publicUnit).not.toHaveBeenCalled();
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { identityId: 'viewer', unitId: 'home', collection: null } });
  });
});
