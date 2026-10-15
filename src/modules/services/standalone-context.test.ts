import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { getConfig } from '@/modules/config';
import { parseStandaloneContext, validateStandaloneServiceContext } from './standalone-context';
import { createServiceOrder } from './service-order.service';
vi.mock('@/modules/config', () => ({ getConfig: vi.fn() }));
vi.mock('@/modules/analytics', () => ({ track: vi.fn() }));
vi.mock('./provider-notify', () => ({ notifyProviderMembers: vi.fn() }));
const context = { kind: 'standalone' as const, destinationKey: 'phuket', areaKey: 'bang-tao', address: '10 Example Road, Phuket', recipientName: 'Test Guest', recipientPhone: '+66000000000' };
const configured = { enabled: true, serviceId: 'service', responsibleOrganizationId: 'organization', destinationKey: 'phuket', areaKeys: ['bang-tao'], termsVersion: 2, takeRatePct: 12 };
const fake = {
  organization: { findUnique: vi.fn() }, area: { findUnique: vi.fn() },
  service: { findUnique: vi.fn() }, serviceProject: { findMany: vi.fn() }, serviceOrder: { create: vi.fn() },
};
const db = fake as unknown as PrismaClient;
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getConfig).mockImplementation(async (_db, key) => ({ 'services.standalone_offers': [configured], 'services.take_rate_pct': 15, 'service.cancel_window_hours': 24 }[key as string] as never));
  fake.organization.findUnique.mockResolvedValue({ status: 'active', name: 'Real Organization' });
  fake.area.findUnique.mockResolvedValue({ status: 'live' });
  fake.service.findUnique.mockResolvedValue({ id: 'service', status: 'active', provider_id: 'provider', provider: { status: 'active', vetted_at: new Date() }, basePriceThb: 50000, advanceNoticeHours: 0, priceModel: 'fixed', fulfilmentMode: 'inhouse', title: 'Cleaning' });
  fake.serviceProject.findMany.mockResolvedValue([]);
  fake.serviceOrder.create.mockResolvedValue({ id: 'new-order' });
});
describe('standalone service coverage and canonical money', () => {
  it('requires a complete bounded recipient/address context and strips caller authority claims', () => {
    expect(() => parseStandaloneContext({ ...context, address: '' })).toThrow(/address/);
    expect(parseStandaloneContext({ ...context, responsibleOrganizationId: 'attacker', totalThb: 1 })).toEqual(context);
  });
  it('rejects out-of-coverage locations and inactive organizations', async () => {
    await expect(validateStandaloneServiceContext(db, 'service', { ...context, areaKey: 'uncovered' })).rejects.toThrow(/not available/);
    fake.organization.findUnique.mockResolvedValue({ status: 'suspended' });
    await expect(validateStandaloneServiceContext(db, 'service', context)).rejects.toThrow(/not available/);
  });
  it('fails closed for ambiguous configured supply and draft areas', async () => {
    vi.mocked(getConfig).mockResolvedValue([configured, configured] as never);
    await expect(validateStandaloneServiceContext(db, 'service', context)).rejects.toThrow(/not available/);
    vi.mocked(getConfig).mockResolvedValue([configured] as never);
    fake.area.findUnique.mockResolvedValue({ status: 'draft' });
    await expect(validateStandaloneServiceContext(db, 'service', context)).rejects.toThrow(/area/);
  });
  it('writes no fake property and snapshots canonical price, organization and accepted terms', async () => {
    fake.serviceProject.findMany.mockResolvedValue([{ project_id: 'private-project', enabled: true, public: false, price_override_thb: 9000000, take_rate_pct: 90, lead_time_hours: 99999, terms_version: 99, effective_from: null, effective_to: null }]);
    await createServiceOrder(db, { serviceId: 'service', projectId: null, serviceContext: context, ordererIdentityId: 'customer', ordererRole: 'guest', scheduledStart: new Date('2030-01-01T10:00:00Z'), scheduledEnd: new Date('2030-01-01T11:00:00Z'), quantity: 2, totalThb: 1, tookRatePctSnapshot: 100 });
    const { data } = fake.serviceOrder.create.mock.calls[0][0];
    expect(data.project_id).toBeNull();
    expect(data.total_thb).toBe(100000);
    expect(data.take_rate_pct_snapshot).toBe(12);
    expect(data.service_context).toEqual({ ...context, responsibleOrganizationId: 'organization' });
    expect(data.terms_snapshot).toMatchObject({ version: 2, collector: 'myuno', responsibleOrganizationId: 'organization', cancellationWindowHours: 24, totalThb: 100000 });
  });
  it('rejects mismatched standalone and property contexts before creating an order', async () => {
    await expect(createServiceOrder(db, { serviceId: 'service', projectId: null, unitId: 'foreign-unit', serviceContext: context, ordererIdentityId: 'customer', ordererRole: 'guest', scheduledStart: new Date('2030-01-01T10:00:00Z'), scheduledEnd: new Date('2030-01-01T11:00:00Z'), quantity: 1 })).rejects.toThrow(/cannot contain/);
    expect(fake.serviceOrder.create).not.toHaveBeenCalled();
  });
});
