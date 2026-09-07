import { prisma } from '../db/prisma.service'
import { ServiceDTO, ServiceOrderDTO } from '../types'

/**
 * Simple commission calculation using config from environment (fallback).
 */
function getCommissionPct(projectId?: string) {
  // per-project override could be implemented using a config table; for now env fallback
  const env = process.env.SERVICES_COMMISSION_PCT || '10' // default 10%
  return Number(env) / 100
}

export async function createService(payload: ServiceDTO) {
  const service = await prisma.service.create({ data: {
    providerId: payload.providerId,
    projectId: payload.projectId,
    taxonomyId: payload.taxonomyId,
    titleKey: payload.titleKey,
    descriptionKey: payload.descriptionKey,
    meta: payload.meta as any,
    priceCents: payload.priceCents,
    currency: payload.currency,
    unit: payload.unit || 'per_unit',
    active: payload.active ?? true,
  }})
  return service
}

export async function checkAvailability(serviceId: string, from?: Date, to?: Date, qty = 1) {
  // naive availability check — looks for any overlapping availability ranges with capacity
  const ranges = await prisma.serviceAvailability.findMany({ where: { serviceId } })
  if (!from || !to) return true
  const requestedFrom = from.getTime()
  const requestedTo = to.getTime()
  for (const r of ranges) {
    const rf = new Date(r.from).getTime()
    const rt = new Date(r.to).getTime()
    if (requestedFrom < rt && requestedTo > rf) {
      // overlap, check capacity
      if (r.qty == null || r.qty >= qty) return true
    }
  }
  return false
}

export async function bookService(payload: ServiceOrderDTO) {
  // transactional booking: check availability, create order, snapshot commission
  return await prisma.$transaction(async (tx) => {
    const service = await tx.service.findUnique({ where: { id: payload.serviceId } })
    if (!service) throw new Error('Service not found')

    const available = await checkAvailability(payload.serviceId, payload.scheduledFrom ? new Date(payload.scheduledFrom) : undefined, payload.scheduledTo ? new Date(payload.scheduledTo) : undefined)
    if (!available) throw new Error('Service not available for requested time')

    const commissionPct = getCommissionPct(service.projectId)
    const commissionCents = Math.round((payload.totalCents || service.priceCents) * commissionPct)

    const order = await tx.serviceOrder.create({ data: {
      serviceId: payload.serviceId,
      buyerId: payload.buyerId,
      providerId: payload.providerId,
      state: 'PENDING_PAYMENT',
      scheduledFrom: payload.scheduledFrom ? new Date(payload.scheduledFrom) : null,
      scheduledTo: payload.scheduledTo ? new Date(payload.scheduledTo) : null,
      totalCents: payload.totalCents,
      currency: payload.currency,
      commissionCents,
    }})

    await tx.serviceOrderEvent.create({ data: {
      orderId: order.id,
      actorId: payload.buyerId,
      type: 'ORDER_CREATED',
      data: { note: 'Order created and pending payment' },
    }})

    return order
  })
}

export async function markOrderPaid(orderId: string, paymentRef?: string) {
  const order = await prisma.serviceOrder.update({ where: { id: orderId }, data: { state: 'PAID', paymentRef }})
  await prisma.serviceOrderEvent.create({ data: { orderId: order.id, actorId: 'system', type: 'ORDER_PAID', data: { paymentRef } }})
  return order
}
