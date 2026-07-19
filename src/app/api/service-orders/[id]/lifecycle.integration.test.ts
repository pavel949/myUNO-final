import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  db,
  resetDb,
  createIdentity,
  createProject,
  createProvider,
  createService,
} from '@/test/util';
import { verifyAndConfirm } from '@/modules/finance';

// Routes read the session via getCurrentUser — mock it per test
const mockGetCurrentUser = vi.fn();
vi.mock('@/app/actions/getCurrentUser', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

// Route modules use the shared client; point it at the test DB client
vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});

import { GET as getOrder } from './route';
import { POST as checkout } from './checkout/route';
import { POST as recordCash } from './record-cash-payment/route';
import { POST as accept } from './accept/route';
import { POST as decline } from './decline/route';
import { POST as fulfil } from './fulfil/route';
import { POST as cancel } from './cancel/route';

function post(body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/service-orders/x', {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
    headers: { 'Content-Type': 'application/json' },
  });
}

const get = () => new NextRequest('http://localhost/api/service-orders/x');

type Role = {
  role: string;
  projectId: string | null;
  unitId: string | null;
  organizationId: string | null;
  providerId: string | null;
};

function userOf(identity: { id: string; email: string | null }, opts?: {
  isAdmin?: boolean;
  roles?: Partial<Role>[];
}) {
  return {
    identityId: identity.id,
    email: identity.email,
    firstName: 'T',
    lastName: 'U',
    isAdmin: opts?.isAdmin ?? false,
    roles: (opts?.roles ?? []).map((r) => ({
      role: r.role ?? 'guest',
      projectId: r.projectId ?? null,
      unitId: r.unitId ?? null,
      organizationId: r.organizationId ?? null,
      providerId: r.providerId ?? null,
    })),
  };
}

describe('service-order lifecycle routes (S1)', () => {
  let orderer: Awaited<ReturnType<typeof createIdentity>>;
  let staff: Awaited<ReturnType<typeof createIdentity>>;
  let providerMember: Awaited<ReturnType<typeof createIdentity>>;
  let stranger: Awaited<ReturnType<typeof createIdentity>>;
  let providerId: string;
  let otherProviderId: string;
  let orderId: string;

  async function makeOrder(opts?: { daysAhead?: number }) {
    const project = await createProject({ status: 'live' });
    const provider = await createProvider({ status: 'active' });
    await db.provider.update({
      where: { id: provider.id },
      data: { vetted_at: new Date() },
    });
    const service = await createService({
      providerId: provider.id,
      status: 'active',
      basePriceThb: 80000,
    });
    const start = new Date(
      Date.now() + (opts?.daysAhead ?? 7) * 24 * 60 * 60 * 1000
    );
    const order = await db.serviceOrder.create({
      data: {
        service_id: service.id,
        provider_id: provider.id,
        project_id: project.id,
        orderer_identity_id: orderer.id,
        orderer_role: 'guest',
        scheduled_start: start,
        scheduled_end: new Date(start.getTime() + 2 * 60 * 60 * 1000),
        quantity: 1,
        price_breakdown: { base_thb: 80000, quantity: 1, total_thb: 80000 },
        total_thb: 80000,
        take_rate_pct_snapshot: 15,
        status: 'placed',
      },
    });
    providerId = provider.id;
    orderId = order.id;
  }

  beforeEach(async () => {
    await resetDb();
    orderer = await createIdentity({ firstName: 'Orderer' });
    staff = await createIdentity({ firstName: 'Ops' });
    providerMember = await createIdentity({ firstName: 'Member' });
    stranger = await createIdentity({ firstName: 'Stranger' });
    const otherProvider = await createProvider({ status: 'active' });
    otherProviderId = otherProvider.id;
    await makeOrder();
  });

  const asOrderer = () => mockGetCurrentUser.mockResolvedValue(userOf(orderer));
  const asStaff = () =>
    mockGetCurrentUser.mockResolvedValue(
      userOf(staff, { roles: [{ role: 'staff_ops' }] })
    );
  const asProviderMember = (pid?: string) =>
    mockGetCurrentUser.mockResolvedValue(
      userOf(providerMember, {
        roles: [{ role: 'provider_member', providerId: pid ?? providerId }],
      })
    );
  const asStranger = () => mockGetCurrentUser.mockResolvedValue(userOf(stranger));

  describe('cash payment', () => {
    it('staff records cash: placed → paid, Payment row written', async () => {
      asStaff();
      const res = await recordCash(post({ receiptRef: 'чек-001' }), {
        params: { id: orderId },
      });
      expect(res.status).toBe(200);

      const order = await db.serviceOrder.findUnique({ where: { id: orderId } });
      expect(order?.status).toBe('paid');

      const payment = await db.payment.findFirst({
        where: { serviceOrderId: orderId },
      });
      expect(payment?.status).toBe('succeeded');
      expect(payment?.amountThb).toBe(80000);
      expect(payment?.receiptRef).toBe('чек-001');
    });

    it('non-staff cannot record cash', async () => {
      asOrderer();
      const res = await recordCash(post({ receiptRef: 'x' }), {
        params: { id: orderId },
      });
      expect(res.status).toBe(403);
    });

    it('rejects a second payment', async () => {
      asStaff();
      await recordCash(post({ receiptRef: 'a' }), { params: { id: orderId } });
      const res = await recordCash(post({ receiptRef: 'b' }), {
        params: { id: orderId },
      });
      expect(res.status).toBe(400);
    });
  });

  describe('card checkout', () => {
    it('orderer opens checkout; confirm flips placed → paid', async () => {
      asOrderer();
      const res = await checkout(post(), { params: { id: orderId } });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.checkoutUrl).toContain('/checkout/');

      await verifyAndConfirm(db, data.sessionId);
      const order = await db.serviceOrder.findUnique({ where: { id: orderId } });
      expect(order?.status).toBe('paid');
    });

    it('only the orderer can open checkout', async () => {
      asProviderMember();
      const res = await checkout(post(), { params: { id: orderId } });
      expect(res.status).toBe(403);
    });
  });

  describe('provider actions', () => {
    it('provider member accepts a placed order', async () => {
      asProviderMember();
      const res = await accept(post(), { params: { id: orderId } });
      expect(res.status).toBe(200);
      const order = await db.serviceOrder.findUnique({ where: { id: orderId } });
      expect(order?.status).toBe('accepted');
    });

    it("a different provider's member cannot act (404 — existence hidden)", async () => {
      asProviderMember(otherProviderId);
      const res = await accept(post(), { params: { id: orderId } });
      expect(res.status).toBe(404);
    });

    it('the orderer cannot accept their own order', async () => {
      asOrderer();
      const res = await accept(post(), { params: { id: orderId } });
      expect(res.status).toBe(403);
    });

    it('decline after cash payment refunds in full and writes the ledger', async () => {
      asStaff();
      await recordCash(post({ receiptRef: 'r1' }), { params: { id: orderId } });

      asProviderMember();
      const res = await decline(post({ reason: 'unavailable' }), {
        params: { id: orderId },
      });
      expect(res.status).toBe(200);

      const order = await db.serviceOrder.findUnique({ where: { id: orderId } });
      expect(order?.status).toBe('declined');

      const refund = await db.refund.findFirst({
        where: { payment: { serviceOrderId: orderId } },
      });
      expect(refund?.amountThb).toBe(80000);

      const ledger = await db.ledgerEntry.findFirst({
        where: { serviceOrderId: orderId, entryType: 'refund_out' },
      });
      expect(ledger?.amountThb).toBe(-80000);
    });

    it('fulfil moves accepted → fulfilled', async () => {
      asProviderMember();
      await accept(post(), { params: { id: orderId } });
      const res = await fulfil(post(), { params: { id: orderId } });
      expect(res.status).toBe(200);
      const order = await db.serviceOrder.findUnique({ where: { id: orderId } });
      expect(order?.status).toBe('fulfilled');
    });
  });

  describe('cancellation (F-SVC-3)', () => {
    it('cancelling outside the window refunds 100% and notifies the orderer', async () => {
      asStaff();
      await recordCash(post({ receiptRef: 'r2' }), { params: { id: orderId } });

      asOrderer();
      const res = await cancel(post({ reason: 'changed plans' }), {
        params: { id: orderId },
      });
      expect(res.status).toBe(200);

      const order = await db.serviceOrder.findUnique({ where: { id: orderId } });
      expect(order?.status).toBe('cancelled');
      expect(order?.refund_accrued_thb).toBe(80000);

      const notification = await db.notification.findFirst({
        where: { identityId: orderer.id, type: 'order_cancelled' },
      });
      expect(notification).not.toBeNull();
    });

    it('cancelling inside the window refunds nothing', async () => {
      // Fresh order scheduled only 2 hours out (< 24h cancel window)
      await makeOrder({ daysAhead: 0 });
      await db.serviceOrder.update({
        where: { id: orderId },
        data: { scheduled_start: new Date(Date.now() + 2 * 60 * 60 * 1000) },
      });
      asStaff();
      await recordCash(post({ receiptRef: 'r3' }), { params: { id: orderId } });

      asOrderer();
      const res = await cancel(post(), { params: { id: orderId } });
      expect(res.status).toBe(200);

      const order = await db.serviceOrder.findUnique({ where: { id: orderId } });
      expect(order?.status).toBe('cancelled');
      expect(order?.refund_accrued_thb).toBe(0);
      const refunds = await db.refund.findMany({
        where: { payment: { serviceOrderId: orderId } },
      });
      expect(refunds).toHaveLength(0);
    });

    it('a stranger cannot cancel (404 — existence hidden)', async () => {
      asStranger();
      const res = await cancel(post(), { params: { id: orderId } });
      expect(res.status).toBe(404);
    });
  });

  describe('order detail', () => {
    it('serializes camelCase and never leaks the take rate', async () => {
      asOrderer();
      const res = await getOrder(get(), { params: { id: orderId } });
      expect(res.status).toBe(200);
      const raw = await res.text();
      expect(raw).not.toContain('take_rate');
      expect(raw).not.toContain('takeRate');
      const data = JSON.parse(raw);
      expect(data.order.totalThb).toBe(80000);
      expect(data.order.status).toBe('placed');
      expect(data.order.serviceTitle).toBeTruthy();
    });

    it('provider member can view; stranger gets 404', async () => {
      asProviderMember();
      expect((await getOrder(get(), { params: { id: orderId } })).status).toBe(200);
      asStranger();
      expect((await getOrder(get(), { params: { id: orderId } })).status).toBe(404);
    });
  });
});
