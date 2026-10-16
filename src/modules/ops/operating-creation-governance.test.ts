import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OPERATING_SPACE_CAPABILITIES } from './operating-space.service';

const state = vi.hoisted(() => ({ founder: true, eligible: ['unit-a'], legacy: ['unit-a'] }));
const access = vi.hoisted(() => ({ legacy: vi.fn() }));
vi.mock('./operating-space-access.service', () => ({
  OperatingAccessError: class extends Error { constructor(message: string, public status = 403) { super(message); } },
  getOperationalActor: async () => ({ id: 'founder', isAdmin: state.founder, status: 'active' }),
  eligibleOrganizationUnits: async () => state.eligible.map(id => ({ id })),
  getLegacyOperationalUnitIds: access.legacy,
  validOperatingCapabilities: (value: unknown) => Array.isArray(value) && value.every(cap => OPERATING_SPACE_CAPABILITIES.includes(cap)),
}));
import { updateGovernedOperatingMember } from './operating-space-governance.service';

function fixture() {
  const space = { id: 'space-a', organizationId: 'org-a', status: 'active', updatedAt: new Date('2026-10-15T00:00:00.000Z') };
  const tx = {
    operatingSpace: { findUnique: vi.fn(async () => space), updateMany: vi.fn(async () => ({ count: 1 })) },
    organization: { findUnique: vi.fn(async () => ({ status: 'active' })) },
    identity: { findUnique: vi.fn(async () => ({ id: 'employee', status: 'active' })) },
    operatingSpaceUnit: { findMany: vi.fn(async () => [{ unitId: 'unit-a' }, { unitId: 'outside' }]) },
    operatingSpaceMember: { findUnique: vi.fn(async () => null), upsert: vi.fn(async (args: any) => ({ id: 'member', ...args.create })) },
    unit: { count: vi.fn(async () => 1) }, auditLog: { create: vi.fn(async () => ({})) },
  };
  const db = { $transaction: async (run: (tx: any) => Promise<unknown>) => run(tx) };
  const input = { identityId: 'employee', active: true, expectedUpdatedAt: space.updatedAt.toISOString(), capabilities: ['create_unit'] };
  return { tx, db: db as any, input };
}

beforeEach(() => { state.founder = true; state.eligible = ['unit-a']; state.legacy = ['unit-a']; vi.clearAllMocks(); access.legacy.mockImplementation(async () => state.legacy); });

describe('independent founder-granted creation capabilities', () => {
  it.each(['create_unit', 'create_complex'])('grants only %s without creating legacy operational roles', async capability => {
    const { db, tx, input } = fixture();
    const result = await updateGovernedOperatingMember(db, 'founder', 'space-a', { ...input, capabilities: [capability] });
    expect(result.capabilities).toEqual([capability]);
    expect(access.legacy).not.toHaveBeenCalled();
    expect(tx.unit.count).toHaveBeenCalledWith({ where: { id: { in: ['unit-a'] }, status: { not: 'offboarded' }, project: { status: { not: 'archived' } } } });
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
  });
  it('does not infer the other creation capability or any daily access', async () => {
    const { db, tx, input } = fixture();
    await updateGovernedOperatingMember(db, 'founder', 'space-a', input);
    expect(tx.operatingSpaceMember.upsert.mock.calls[0][0].create.capabilities).toEqual(['create_unit']);
  });
  it('requires founder authority even for a current manager', async () => {
    state.founder = false; const { db, tx, input } = fixture();
    await expect(updateGovernedOperatingMember(db, 'manager', 'space-a', input)).rejects.toMatchObject({ status: 403 });
    expect(tx.operatingSpaceMember.upsert).not.toHaveBeenCalled();
  });
  it('rejects an empty or no-longer-eligible workspace', async () => {
    state.eligible = []; const { db, tx, input } = fixture(); tx.unit.count.mockResolvedValue(0);
    await expect(updateGovernedOperatingMember(db, 'founder', 'space-a', input)).rejects.toMatchObject({ status: 409 });
    expect(tx.operatingSpaceMember.upsert).not.toHaveBeenCalled();
  });
  it('rejects inactive organizations and target identities', async () => {
    const { db, tx, input } = fixture(); tx.organization.findUnique.mockResolvedValue({ status: 'inactive' });
    await expect(updateGovernedOperatingMember(db, 'founder', 'space-a', input)).rejects.toMatchObject({ status: 400 });
    tx.organization.findUnique.mockResolvedValue({ status: 'active' }); tx.identity.findUnique.mockResolvedValue({ id: 'employee', status: 'blocked' });
    await expect(updateGovernedOperatingMember(db, 'founder', 'space-a', input)).rejects.toMatchObject({ status: 400 });
    expect(tx.operatingSpaceMember.upsert).not.toHaveBeenCalled();
  });
  it('preserves the independent legacy prerequisites for mixed daily capabilities', async () => {
    state.legacy = []; const { db, tx, input } = fixture();
    await expect(updateGovernedOperatingMember(db, 'founder', 'space-a', { ...input, capabilities: ['create_unit', 'manage_tasks'] })).rejects.toMatchObject({ status: 409 });
    expect(access.legacy).toHaveBeenCalledTimes(1);
    expect(tx.operatingSpaceMember.upsert).not.toHaveBeenCalled();
  });
  it('does not open unsupported pricing or finance grants', async () => {
    const { db, tx, input } = fixture();
    await expect(updateGovernedOperatingMember(db, 'founder', 'space-a', { ...input, capabilities: ['create_unit', 'manage_pricing'] })).rejects.toMatchObject({ status: 409 });
    expect(tx.operatingSpaceMember.upsert).not.toHaveBeenCalled();
  });
  it('rejects a stale workspace revision before changing membership', async () => {
    const { db, tx, input } = fixture(); tx.operatingSpace.updateMany.mockResolvedValue({ count: 0 });
    await expect(updateGovernedOperatingMember(db, 'founder', 'space-a', input)).rejects.toMatchObject({ status: 409 });
    expect(tx.operatingSpaceMember.upsert).not.toHaveBeenCalled();
  });
});
