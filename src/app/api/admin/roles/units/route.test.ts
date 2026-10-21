import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const mocks = vi.hoisted(() => ({ requireAction: vi.fn(), findMany: vi.fn() }));
vi.mock('@/app/libs/onboardingGuard', () => ({ requireAction: mocks.requireAction }));
vi.mock('@/lib/prisma', () => ({ prisma: { unit: { findMany: mocks.findMany } } }));

describe('founder exact-unit role picker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAction.mockResolvedValue({ ok: true });
    mocks.findMany.mockResolvedValue([]);
  });

  it('requires people-edit authority before looking up units', async () => {
    mocks.requireAction.mockResolvedValue({ ok: false, error: new Response('Forbidden', { status: 403 }) });
    expect((await GET(new Request('http://localhost/api/admin/roles/units?projectId=complex-a'))).status).toBe(403);
    expect(mocks.requireAction).toHaveBeenCalledWith('people:edit');
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it.each(['', '?projectId=', `?projectId=${'a'.repeat(201)}`, `?projectId=a&q=${'a'.repeat(201)}`])('rejects malformed lookup %s', async query => {
    expect((await GET(new Request(`http://localhost/api/admin/roles/units${query}`))).status).toBe(400);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it('limits results, binds the project, and selects only identity fields', async () => {
    const items = Array.from({ length: 51 }, (_, i) => ({ id: `unit-${i}`, name: `Unit ${i}` }));
    mocks.findMany.mockResolvedValue(items);
    const response = await GET(new Request('http://localhost/api/admin/roles/units?projectId=complex-a&q=unit-1'));
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { projectId: 'complex-a', OR: [ { name: { contains: 'unit-1', mode: 'insensitive' } }, { id: 'unit-1' } ] },
      select: { id: true, name: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }], take: 51,
    });
    expect(await response.json()).toEqual({ items: items.slice(0, 50), hasMore: true });
  });
});
