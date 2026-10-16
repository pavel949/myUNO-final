import type { Prisma, PrismaClient } from '@prisma/client';
import { getConfig } from '@/modules/config';

type OrderDb = Prisma.TransactionClient;
export const FULFILMENT_WINDOW_KEY = 'service.fulfilment_confirm_window_hours' as const;

export class ServiceOrderClosureError extends Error {
  constructor(public readonly code: 'not_found' | 'forbidden' | 'state' | 'disputed' | 'window_expired') {
    super(`Service order confirmation: ${code}`);
  }
}

/** Shared by provider fulfilment, customer confirmation, dispute creation and the sweep. */
export async function lockServiceOrder(db: OrderDb, id: string) {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
  await db.$queryRaw`SELECT id FROM service_order WHERE id = ${id} FOR UPDATE`;
}

export function fulfilmentDeadline(fulfilledAt: Date | null, hours: unknown): Date | null {
  if (typeof hours !== 'number' || !Number.isSafeInteger(hours) || hours <= 0) {
    throw new Error('Fulfilment confirmation window must be a positive whole number of hours');
  }
  if (!fulfilledAt) return null; // Never invent a legacy recognition timestamp from updated_at.
  const deadline = new Date(fulfilledAt.getTime() + hours * 3_600_000);
  if (!Number.isFinite(deadline.getTime())) throw new Error('Fulfilment confirmation deadline is out of range');
  return deadline;
}

export async function serviceOrderDeadline(db: OrderDb, order: { project_id: string | null; fulfilled_at: Date | null }) {
  const hours = await getConfig(db, FULFILMENT_WINDOW_KEY, { projectId: order.project_id ?? undefined, fresh: true });
  return fulfilmentDeadline(order.fulfilled_at, hours ?? 48);
}

export async function assertServiceOrderDisputable(db: OrderDb, id: string) {
  // Caller owns the shared row lock and has already checked the orderer's identity.
  const order = await db.serviceOrder.findUniqueOrThrow({ where: { id } });
  if (order.status === 'closed') throw new ServiceOrderClosureError('state');
  if (order.status === 'fulfilled') {
    const deadline = await serviceOrderDeadline(db, order);
    if (!deadline || new Date() >= deadline) throw new ServiceOrderClosureError('window_expired');
  }
}

async function closeLockedOrder(db: OrderDb, id: string, identityId?: string): Promise<boolean> {
  const order = await db.serviceOrder.findUnique({ where: { id } });
  if (!order) throw new ServiceOrderClosureError('not_found');
  if (identityId && order.orderer_identity_id !== identityId) throw new ServiceOrderClosureError('forbidden');
  if (order.status === 'closed') return false; // Safe retry after a lost acknowledgement.
  if (order.status !== 'fulfilled') {
    if (identityId) throw new ServiceOrderClosureError('state');
    return false;
  }
  const deadline = await serviceOrderDeadline(db, order);
  const now = new Date();
  if (!deadline) {
    if (identityId) throw new ServiceOrderClosureError('state');
    return false;
  }
  const dispute = await db.dispute.findFirst({ where: { subjectType: 'service_order', subjectId: id, decidedAt: null }, select: { id: true } });
  if (dispute) {
    if (identityId) throw new ServiceOrderClosureError('disputed');
    return false;
  }
  if (identityId && now >= deadline) throw new ServiceOrderClosureError('window_expired');
  if (!identityId && now < deadline) return false;
  await db.serviceOrder.update({ where: { id }, data: { status: 'closed', closed_at: now, closed_by_identity_id: identityId ?? null } });
  // Administrative closure never recognizes commission again or creates a payout/refund.
  return true;
}

export async function confirmServiceOrder(db: PrismaClient, id: string, identityId: string) {
  return db.$transaction(async tx => {
    await lockServiceOrder(tx, id);
    return { closed: await closeLockedOrder(tx, id, identityId), status: 'closed' as const };
  });
}

/** Cursor pagination avoids repeatedly starving later orders behind a disputed/not-yet-due batch. */
export async function closeFulfilledServiceOrders(db: PrismaClient): Promise<number> {
  let cursor: string | undefined;
  let closed = 0;
  for (;;) {
    const batch = await db.serviceOrder.findMany({ where: { status: 'fulfilled', fulfilled_at: { not: null } }, select: { id: true }, orderBy: { id: 'asc' }, take: 100, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    if (!batch.length) return closed;
    for (const order of batch) {
      if (await db.$transaction(async tx => {
        await lockServiceOrder(tx, order.id);
        return closeLockedOrder(tx, order.id);
      })) closed++;
    }
    cursor = batch[batch.length - 1].id;
  }
}
