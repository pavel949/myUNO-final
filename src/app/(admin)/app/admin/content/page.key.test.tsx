import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ guard: vi.fn(), group: vi.fn(), keys: vi.fn(), labels: vi.fn() }));
vi.mock('@/app/libs/requireAdminPage', () => ({ requireAdminPage: mocks.guard }));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NEXT_NOT_FOUND'); } }));
vi.mock('@/lib/prisma', () => ({ prisma: { contentKey: { groupBy: mocks.group, findMany: mocks.keys } } }));
vi.mock('@/lib/i18n', () => ({ getLabels: mocks.labels }));
import AdminContentPage from './page';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.guard.mockResolvedValue({ isAdmin: true });
  mocks.group.mockResolvedValue([{ namespace: 'unit', _count: { key: 251 } }]);
  mocks.labels.mockImplementation(async (labels: object) => labels);
  mocks.keys.mockResolvedValue([]);
});
it('filters the exact unit key before the 200-row limit, preserving editor stable ID', async () => {
  const rows = Array.from({ length: 251 }, (_, i) => ({ id: `key-${i}`, key: `unit.${String(i).padStart(3, '0')}.description`, namespace: 'unit', description: '', translations: [] }));
  const target = rows[250];
  mocks.keys.mockImplementation(async ({ where, take }) => rows.filter(row => row.namespace === where.namespace && (!where.key || row.key === where.key)).slice(0, take));
  const result = await AdminContentPage({ searchParams: { ns: 'unit', key: target.key } });
  expect(mocks.keys).toHaveBeenCalledWith(expect.objectContaining({ where: { namespace: 'unit', key: target.key }, take: 200 }));
  const props = JSON.stringify(result, (key, value) => key === 'type' || key === '_owner' ? undefined : value);
  expect(props).toContain(target.id); expect(props).toContain(target.key); expect(props).not.toContain(rows[0].key);
});
it.each(['', '<script>', 'inline prose', 'x'.repeat(241)])('rejects invalid exact key %s before querying content', async key => {
  await expect(AdminContentPage({ searchParams: { ns: 'unit', key } })).rejects.toThrow('NEXT_NOT_FOUND');
  expect(mocks.group).not.toHaveBeenCalled(); expect(mocks.keys).not.toHaveBeenCalled();
});
it('retains namespace isolation when an exact key names another namespace', async () => {
  await AdminContentPage({ searchParams: { ns: 'unit', key: 'project.other.description' } });
  expect(mocks.keys).toHaveBeenCalledWith(expect.objectContaining({ where: { namespace: 'unit', key: 'project.other.description' } }));
});
it('keeps the admin guard ahead of all content reads', async () => {
  mocks.guard.mockRejectedValue(new Error('DENIED'));
  await expect(AdminContentPage({ searchParams: { ns: 'unit', key: 'unit.one.description' } })).rejects.toThrow('DENIED');
  expect(mocks.group).not.toHaveBeenCalled(); expect(mocks.keys).not.toHaveBeenCalled(); expect(mocks.labels).not.toHaveBeenCalled();
});

it.each([undefined, '', 'invalid namespace', 'x'.repeat(241)])('requires a valid explicit namespace for exact-key selection', async ns => {
  await expect(AdminContentPage({ searchParams: { ns, key: 'unit.one.description' } })).rejects.toThrow('NEXT_NOT_FOUND');
  expect(mocks.keys).not.toHaveBeenCalled();
});
