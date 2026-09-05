import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  createIdentity,
  createOrganization,
  createProject,
  createProvider,
  createService,
  createUnit,
  db,
  resetDb,
} from '@/test/util';

const mockGetCurrentUser = vi.fn();
vi.mock('@/app/actions/getCurrentUser', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});

import { POST } from './route';

function postRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/service-orders/x/record-cash-payment', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/service-orders/[id]/record-cash-payment — MC authorization', () => {
  let operator: Awaited<ReturnType<typeof createIdentity>>;
  let owner: Awaited<ReturnType<typeof createIdentity>>;
  let orderer: Awaited<ReturnType<typeof createIdentity>>;
  let orderId: string;
  let projectId: string;
  let managedOrgId: string;
  let otherOrgId: string;

  beforeEach(async () => {
    await resetDb();
    mockGetCurrentUser.mockReset();

    operator = await createIdentity({ firstName: 'MC' });
    owner = await createIdentity({ firstName: 'Owner' });
    orderer = await createIdentity({ firstName: 'Guest' });
    const project = await createProject({ status: 'live' });
    projectId = project.id;
    const managedOrg = await createOrganization('MC Alpha', projectId, 'management_company');
    const otherOrg = await createOrganization('MC Beta', projectId, 'management_company');
    managedOrgId = managedOrg.id;
    otherOrgId = otherOrg.id;

    const unit = await createUnit({ projectId, ownerIdentityId: owner.id, status: 'live' });
    await db.unitEngagement.create({
      data: {
        unitId: unit.id,
        ownerIdentityId: owner.id,
        engagementType: 'via_management_company',
        managementOrgId: managedOrg.id,
        status: 'active',
      },
    });

    const provider = await createProvider({ status: 'active' });
    await db.provider.update({
      where: { id: provider.id },
      data: { vetted_at: new Date() },
    });
    const service = await createService({
      providerId: provider.id,
      status: 'active',
      basePriceThb: 60_000,
    });

    const order = await db.serviceOrder.create({
      data: {
        service_id: service.id,
        provider_id: provider.id,
        project_id: projectId,
        unit_id: unit.id,
        orderer_identity_id: orderer.id,
        orderer_role: 'guest',
        status: 'placed',
        scheduled_start: new Date('2026-08-20T09:00:00Z'),
        scheduled_end: new Date('2026-08-20T11:00:00Z'),
        quantity: 1,
        price_breakdown: { base_thb: 60_000, quantity: 1, total_thb: 60_000 },
        total_thb: 60_000,
        take_rate_pct_snapshot: 15,
      },
    });
    orderId = order.id;
  });

  function asMcMember(organizationId: string) {
    mockGetCurrentUser.mockResolvedValue({
      identityId: operator.id,
      email: operator.email,
      firstName: 'MC',
      lastName: 'Member',
      isAdmin: false,
      roles: [
        {
          role: 'mc_member',
          projectId,
          unitId: null,
          organizationId,
          providerId: null,
        },
      ],
    });
  }

  it('allows managed MC member to record cash', async () => {
    asMcMember(managedOrgId);
    const response = await POST(postRequest({ receiptRef: 'svc-mc-001' }), {
      params: { id: orderId },
    });
    expect(response.status).toBe(200);

    const payment = await db.payment.findFirst({
      where: { serviceOrderId: orderId, receiptRef: 'svc-mc-001' },
    });
    expect(payment).not.toBeNull();
  });

  it('blocks MC member outside managing organization', async () => {
    asMcMember(otherOrgId);
    const response = await POST(postRequest({ receiptRef: 'svc-mc-002' }), {
      params: { id: orderId },
    });
    expect(response.status).toBe(404);
  });
});
