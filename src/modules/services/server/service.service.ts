import { prisma } from '../db/prisma.service'
import { ServiceDTO, ServiceOrderDTO } from '../types'
import { getCommissionPct } from './service.service'
import { validateIndustryMeta } from '../validation/validate'

export async function createService(payload: ServiceDTO) {
  // Validate industry meta if taxonomy has slug
  const taxonomy = payload.taxonomyId ? await prisma.serviceTaxonomy.findUnique({ where: { id: payload.taxonomyId } }) : null
  const slug = taxonomy?.slug
  const validatedMeta = validateIndustryMeta(slug, payload.meta)

  const service = await prisma.service.create({ data: {
    providerId: payload.providerId,
    projectId: payload.projectId,
    taxonomyId: payload.taxonomyId,
    titleKey: payload.titleKey,
    descriptionKey: payload.descriptionKey,
    meta: validatedMeta as any,
    priceCents: payload.priceCents,
    currency: payload.currency,
    unit: payload.unit || 'per_unit',
    active: payload.active ?? true,
  }})
  return service
}

export async function bookService(payload: ServiceOrderDTO) {
  // transactional booking: check availability, create order, snapshot commission
  return await prisma.$transaction(async (tx) => {
    const service = await tx.service.findUnique({ where: { id: payload.serviceId } })
    if (!service) throw new Error('Service not found')

    const available = await checkAvailability(payload.serviceId, payload.scheduledFrom ? new Date(payload.scheduledFrom) : undefined, payload.scheduledTo ? new Date(payload.scheduledTo) : undefined)
    if (!available) throw new Error('Service not available for requested time')

    const commissionPct = getCommissionPct(service.projectId)
    const total = payload.totalCents || service.priceCents
    const commissionCents = Math.round(total * commissionPct)

    const order = await tx.serviceOrder.create({ data: {
      serviceId: payload.serviceId,
      buyerId: payload.buyerId,
      providerId: payload.providerId,
      state: 'PENDING_PAYMENT',
      scheduledFrom: payload.scheduledFrom ? new Date(payload.scheduledFrom) : null,
      scheduledTo: payload.scheduledTo ? new Date(payload.scheduledTo) : null,
      totalCents: total,
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
