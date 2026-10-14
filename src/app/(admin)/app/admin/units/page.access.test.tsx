import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  units: vi.fn(),
  unit: vi.fn(),
  projects: vi.fn(),
  categories: vi.fn(),
  ratePlans: vi.fn(),
  unitCount: vi.fn(),
  contentKey: vi.fn(),
  labels: vi.fn(),
  redirect: vi.fn((path: string): never => { throw new Error(`NEXT_REDIRECT:${path}`); }),
  notFound: vi.fn((): never => { throw new Error('NEXT_NOT_FOUND'); }),
}));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: mocks.user }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
vi.mock('@/lib/prisma', () => ({ prisma: {
  unit: { findMany: mocks.units, findUnique: mocks.unit, count: mocks.unitCount },
  project: { findMany: mocks.projects },
  inventoryCategory: { findMany: mocks.categories },
  ratePlan: { findMany: mocks.ratePlans },
  contentKey: { findUnique: mocks.contentKey },
} }));
vi.mock('@/lib/i18n', () => ({ getLabels: mocks.labels }));
import AdminUnitsPage from './page';
import UnitOnboardingPage from './[id]/page';

const privateUnit = {
  id: 'synthetic-private-unit', name: 'SYNTHETIC_PRIVATE_UNIT', projectId: 'synthetic-private-project',
  project: { id: 'synthetic-private-project', name: 'SYNTHETIC_PRIVATE_PROJECT', status: 'draft' },
  status: 'draft', assetStatus: 'managed', inventoryCategory: null, inventoryCategoryId: null,
  categoryKey: null, owner: null, baseNightlyThb: 730000, minNights: 1,
  instantBook: false, permittedUseConfirmedAt: null, coverMedia: null,
  engagements: [], complianceRecords: [], mobilizationChecklist: [],
};
const privateReads = [mocks.units, mocks.unit, mocks.projects, mocks.categories,
  mocks.ratePlans, mocks.unitCount, mocks.contentKey, mocks.labels];
const pages = [
  ['inventory', () => AdminUnitsPage()],
  ['detail', () => UnitOnboardingPage({ params: { id: privateUnit.id } })],
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ identityId: 'synthetic-admin', isAdmin: true });
  mocks.units.mockResolvedValue([privateUnit]);
  mocks.unit.mockResolvedValue(privateUnit);
  mocks.projects.mockResolvedValue([]);
  mocks.categories.mockResolvedValue([]);
  mocks.ratePlans.mockResolvedValue([]);
  mocks.unitCount.mockResolvedValue(1);
  mocks.contentKey.mockResolvedValue({ namespace: 'unit' });
  mocks.labels.mockImplementation(async (keys: object) => keys);
});

describe.each(pages)('%s page checks existing admin authorization before private reads', (_name, page) => {
  it.each([
    [null, '/login?next=/app/admin'],
    [{ identityId: 'synthetic-non-admin', isAdmin: false }, '/'],
  ])('redirects a denied identity without reading or returning inventory', async (user, target) => {
    mocks.user.mockResolvedValue(user);
    await expect(page()).rejects.toThrow(`NEXT_REDIRECT:${target}`);
    expect(mocks.redirect).toHaveBeenCalledWith(target);
    for (const read of privateReads) expect(read).not.toHaveBeenCalled();
  });

  it('does not start private reads while the existing user lookup is unresolved', async () => {
    let resolveUser!: (value: null) => void;
    mocks.user.mockReturnValue(new Promise(resolve => { resolveUser = resolve; }));
    const result = page();
    for (const read of privateReads) expect(read).not.toHaveBeenCalled();
    resolveUser(null);
    await expect(result).rejects.toThrow('NEXT_REDIRECT:/login?next=/app/admin');
    for (const read of privateReads) expect(read).not.toHaveBeenCalled();
  });

  it('fails closed if the existing user lookup fails', async () => {
    mocks.user.mockRejectedValue(new Error('Synthetic identity lookup unavailable'));
    await expect(page()).rejects.toThrow('Synthetic identity lookup unavailable');
    for (const read of privateReads) expect(read).not.toHaveBeenCalled();
  });

  it('preserves the authorized admin page and its private projection', async () => {
    const result = await page();
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.user).toHaveBeenCalledTimes(1);
    // Inspect returned props without serializing Next component module objects.
    const props = JSON.stringify(result, (key, value) =>
      key === 'type' || key === '_owner' ? undefined : value);
    expect(props).toContain(privateUnit.name);
    expect(props).toContain(privateUnit.id);
    expect(mocks.user.mock.invocationCallOrder[0]).toBeLessThan(
      Math.min(...privateReads.flatMap(read => read.mock.invocationCallOrder))
    );
  });
});

it('preserves not-found behavior for an authorized admin requesting a missing unit', async () => {
  mocks.unit.mockResolvedValue(null);
  await expect(UnitOnboardingPage({ params: { id: 'missing' } })).rejects.toThrow('NEXT_NOT_FOUND');
  expect(mocks.unit).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'missing' } }));
  expect(mocks.ratePlans).not.toHaveBeenCalled();
});


it('links the unit own description reference to the exact canonical content editor', async () => {
  const descriptionKey = 'unit.synthetic-private-unit.description';
  mocks.unit.mockResolvedValue({ ...privateUnit, descriptionKey });
  const result = await UnitOnboardingPage({ params: { id: privateUnit.id } });
  const props = JSON.stringify(result, (key, value) => key === 'type' || key === '_owner' ? undefined : value);
  expect(props).toContain(`/app/admin/content?ns=unit&key=${encodeURIComponent(descriptionKey)}`);
  expect(props).toContain('Edit description');
});


it('uses the existing content namespace without moving or rewriting the key', async () => {
  const descriptionKey = 'legacy.shared_description';
  mocks.unit.mockResolvedValue({ ...privateUnit, descriptionKey });
  mocks.contentKey.mockResolvedValue({ namespace: 'legacy' });
  const result = await UnitOnboardingPage({ params: { id: privateUnit.id } });
  const props = JSON.stringify(result, (key, value) => key === 'type' || key === '_owner' ? undefined : value);
  expect(mocks.contentKey).toHaveBeenCalledWith({ where: { key: descriptionKey }, select: { namespace: true } });
  expect(props).toContain(`/app/admin/content?ns=legacy&key=${encodeURIComponent(descriptionKey)}`);
  expect(props).not.toContain('/app/admin/content?ns=unit');
  expect(mocks.user.mock.invocationCallOrder[0]).toBeLessThan(mocks.contentKey.mock.invocationCallOrder[0]);
});

it('hides the editor link for a missing legacy key record', async () => {
  mocks.unit.mockResolvedValue({ ...privateUnit, descriptionKey: 'legacy.missing' });
  mocks.contentKey.mockResolvedValue(null);
  const result = await UnitOnboardingPage({ params: { id: privateUnit.id } });
  const props = JSON.stringify(result, (key, value) => key === 'type' || key === '_owner' ? undefined : value);
  expect(props).not.toContain('/app/admin/content?');
});

it('provides RU and TH description-action drafts before a seed is applied', async () => {
  await UnitOnboardingPage({ params: { id: privateUnit.id } });
  expect(mocks.labels).toHaveBeenCalledWith(expect.any(Object), undefined, expect.objectContaining({
    'admin.unit_publication.edit_description': expect.objectContaining({ ru: 'Редактировать описание', th: 'แก้ไขคำอธิบาย' }),
  }));
});

it('keeps gallery and tariff entry points on the same unit workspace', async () => {
  const result = await UnitOnboardingPage({ params: { id: privateUnit.id } });
  const props = JSON.stringify(result, (key, value) => key === 'type' || key === '_owner' ? undefined : value);
  expect(props).toContain('/app/admin/properties/synthetic-private-project/onboarding?gallery=unit:synthetic-private-unit#step-7');
  expect(props).toContain('"href":"#unit-tariffs"');
  expect(props).toContain('"id":"unit-tariffs"');
});
