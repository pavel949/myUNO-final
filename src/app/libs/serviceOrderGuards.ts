import { prisma } from '@/lib/prisma';
import { createPublicError } from '@/app/libs/errorHandler';
import type { CurrentUser } from '@/app/actions/getCurrentUser';

/**
 * Load a service order and establish the caller's relationship to it.
 * Shared by every /api/service-orders/[id]/* route so authz rules live in
 * one place: the orderer, an active provider member of the order's provider,
 * staff_ops, or admin — everyone else sees 404 (not 403 — don't reveal the
 * order exists).
 */
export async function loadOrderForUser(orderId: string, user: CurrentUser) {
  const order = await prisma.serviceOrder.findUnique({
    where: { id: orderId },
    include: {
      service: { select: { title: true } },
      payments: true,
    },
  });

  if (!order) {
    throw createPublicError('not found', 404);
  }

  const isOrderer = order.orderer_identity_id === user.identityId;
  const isProviderMember = user.roles.some(
    (r) => r.role === 'provider_member' && r.providerId === order.provider_id
  );
  const isStaff = user.roles.some((r) => r.role === 'staff_ops');
  const isAdmin = user.isAdmin;

  if (!isOrderer && !isProviderMember && !isStaff && !isAdmin) {
    throw createPublicError('not found', 404);
  }

  return { order, isOrderer, isProviderMember, isStaff, isAdmin };
}
