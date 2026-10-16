import { expect, it, vi } from 'vitest';
import { grantRole } from './roles';

const mocks = vi.hoisted(() => ({ grant: vi.fn().mockResolvedValue({ id: 'grant' }), db: {} }));
vi.mock('@/lib/prisma', () => ({ prisma: mocks.db }));
vi.mock('./people.service', () => ({ grantRole: mocks.grant }));

it('routes legacy editor grants through the strict canonical assignment validation', async () => {
  const input = {
    identityId: 'editor', role: 'pricing_editor' as const,
    scopeType: 'unit' as const, projectId: 'complex-a', unitId: 'unit-a', grantedByIdentityId: 'founder',
  };
  expect(await grantRole(input)).toEqual({ id: 'grant' });
  expect(mocks.grant).toHaveBeenCalledWith(mocks.db, input);
});
