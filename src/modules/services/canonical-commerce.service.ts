import { PrismaClient, RoleType } from '@prisma/client';
import { getConfig } from '@/modules/config';
import { createNotification } from '@/modules/comms';
import { track } from '@/modules/analytics';
import { notifyProviderMembers } from './provider-notify';

export type ServiceContext = {
  area?: string;
  address?: string;
  recipientName?: string;
  recipientPhone?: string;
  note?: string;
};

export type QuantityDimensions = Record<string, number>;

export interface CanonicalServiceOrderInput {
  serviceId: string;
  projectId?: string | null;
  unitId?: string;
  bookingId?: string;
  ordererIdentityId: string;
  ordererRole: RoleType;
  scheduledStart: Date;
  serviceContext?: ServiceContext;
  quantityDimensions: QuantityDimensions;
  noteToProvider?: string;
  quoteVersionId?: string;
}

function positiveInteger(value: unknown, field: string, allowZero = false): number {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || (allowZero ? numberValue < 0 : numberValue < 1)) {
    throw new Error(`${field} must be ${allowZero ? 'a non-negative' : 'a positive'} integer`);
  }
  return numberValue;
}

/**
 * F03 / AT04: validate named dimensions rather than letting one `quantity`
 * silently mean people, hours, vehicles and products in different places.
 * Unknown categories still use an explicit `units` dimension.
 */
export function normalizeServiceDimensions(
  categoryKey: string,
  raw: Record<string, unknown>
): QuantityDimensions {
  switch (categoryKey) {
    case 'transfer':
      return {
        passengers: positiveInteger(raw.passengers, 'passengers'),
        luggage: positiveInteger(raw.luggage ?? 0, 'luggage', true),
        vehicles: positiveInteger(raw.vehicles ?? 1, 'vehicles'),
      };
    case 'chef':
      return {
        guests: positiveInteger(raw.guests, 'guests'),
        hours: positiveInteger(raw.hours ?? 1, 'hours'),
      };
    case 'cleaning': {
      const rooms = raw.rooms == null ? 0 : positiveInteger(raw.rooms, 'rooms');
      const hours = raw.hours == null ? 0 : positiveInteger(raw.hours, 'hours');
      const areaSqm = raw.areaSqm == null ? 0 : positiveInteger(raw.areaSqm, 'areaSqm');
      if (rooms + hours + areaSqm === 0) {
        throw new Error('cleaning requires rooms, hours or areaSqm');
      }
      return { rooms, hours, areaSqm };
    }
    case 'car_hire':
    case 'car_rental':
      return {
        days: positiveInteger(raw.days, 'days'),
        vehicles: positiveInteger(raw.vehicles ?? 1, 'vehicles'),
      };
    case 'flowers':
    case 'deliveries':
    case 'groceries':
      return { items: positiveInteger(raw.items, 'items') };
    default:
      return { units: positiveInteger(raw.units ?? 1, 'units') };
  }
}

function billingQuantity(
  priceModel: 'fixed' | 'per_hour' | 'per_person' | 'quote',
  dimensions: QuantityDimensions
): number {
  if (priceModel === 'per_hour') return dimensions.hours ?? 1;
  if (priceModel === 'per_person') {
    return dimensions.guests ?? dimensions.passengers ?? dimensions.persons ?? 1;
  }
  if (priceModel === 'fixed') {
    return dimensions.items ?? dimensions.units ?? dimensions.vehicles ?? 1;
  }
  return 1;
}

function normalizedStandaloneContext(context?: ServiceContext): ServiceContext {
  const clean = {
    area: context?.area?.trim() || undefined,
    address: context?.address?.trim() || undefined,
    recipientName: context?.recipientName?.trim() || undefined,
    recipientPhone: context?.recipientPhone?.trim() || undefined,
    note: context?.note?.trim() || undefined,
  };
  if (!clean.area && !clean.address) {
    throw new Error('Standalone service orders require a Phuket area or address');
  }
  return clean;
}

async function resolveOrderContext(
  db: PrismaClient,
  input: CanonicalServiceOrderInput
): Promise<{ projectId: string | null; unitId?: string; serviceContext: ServiceContext }> {
  if (input.bookingId) {
    const booking = await db.booking.findUnique({
      where: { id: input.bookingId },
      select: { projectId: true, unitId: true, guestIdentityId: true },
    });
    if (!booking || booking.guestIdentityId !== input.ordererIdentityId) {
      throw new Error('Booking context is invalid for this order');
    }
    if (input.projectId && input.projectId !== booking.projectId) {
      throw new Error('Booking and project context disagree');
    }
    if (input.unitId && input.unitId !== booking.unitId) {
      throw new Error('Booking and unit context disagree');
    }
    return { projectId: booking.projectId, unitId: booking.unitId, serviceContext: input.serviceContext ?? {} };
  }

  const projectId = input.projectId ?? null;
  if (!projectId) {
    if (input.unitId) throw new Error('A unit cannot be supplied without a project context');
    return { projectId: null, serviceContext: normalizedStandaloneContext(input.serviceContext) };
  }

  const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) throw new Error('Unknown project');

  if (input.unitId) {
    const unit = await db.unit.findUnique({ where: { id: input.unitId }, select: { projectId: true } });
    if (!unit || unit.projectId !== projectId) throw new Error('Unit does not belong to this project');
  }
  return { projectId, unitId: input.unitId, serviceContext: input.serviceContext ?? {} };
}

async function resolveCommercialTerms(
  db: PrismaClient,
  service: {
    id: string;
    basePriceThb: number | null;
    priceModel: 'fixed' | 'per_hour' | 'per_person' | 'quote';
    advanceNoticeHours: number;
  },
  projectId: string | null
) {
  const now = new Date();
  const propertyTerms = projectId
    ? await db.serviceProject.findUnique({
        where: { service_id_project_id: { service_id: service.id, project_id: projectId } },
      })
    : null;

  if (propertyTerms) {
    if (!propertyTerms.enabled || !propertyTerms.public) throw new Error('Service is not enabled for this property');
    if (propertyTerms.effectiveFrom && propertyTerms.effectiveFrom > now) throw new Error('Service terms are not effective yet');
    if (propertyTerms.effectiveTo && propertyTerms.effectiveTo <= now) throw new Error('Service terms have expired');
  } else if (projectId) {
    const restrictedCount = await db.serviceProject.count({ where: { service_id: service.id } });
    if (restrictedCount > 0) throw new Error('Service is not available in this project');
  }

  const globalTakeRate =
    ((await getConfig(db, 'services.take_rate_pct', projectId ? { projectId } : undefined)) as number | undefined) ?? 15;
  const takeRatePct = propertyTerms?.takeRatePct != null ? Number(propertyTerms.takeRatePct) : globalTakeRate;
  const basePriceThb = propertyTerms?.priceOverrideThb ?? service.basePriceThb;
  const leadTimeHours = propertyTerms?.leadTimeHours ?? service.advanceNoticeHours;

  return {
    basePriceThb,
    takeRatePct,
    leadTimeHours,
    snapshot: {
      scope: projectId ? 'property' : 'standalone',
      projectId,
      termsVersion: propertyTerms?.termsVersion ?? null,
      priceOverrideThb: propertyTerms?.priceOverrideThb ?? null,
      costThb: propertyTerms?.costThb ?? null,
      takeRatePct,
      leadTimeHours,
      slaMinutes: propertyTerms?.slaMinutes ?? null,
      cancellationPolicy: propertyTerms?.cancellationPolicy ?? {},
      collector: propertyTerms?.collector ?? 'platform',
      fulfillmentOwner: propertyTerms?.fulfillmentOwner ?? 'provider',
      complaintOwner: propertyTerms?.complaintOwner ?? 'platform',
      inclusions: propertyTerms?.inclusions ?? [],
      effectiveFrom: propertyTerms?.effectiveFrom?.toISOString() ?? null,
      effectiveTo: propertyTerms?.effectiveTo?.toISOString() ?? null,
    },
  };
}

/** F01/F02/F03 direct-order write seam. Client money is never trusted. */
export async function createCanonicalServiceOrder(db: PrismaClient, input: CanonicalServiceOrderInput) {
  const context = await resolveOrderContext(db, input);
  const service = await db.service.findUnique({
    where: { id: input.serviceId },
    include: { provider: true },
  });
  if (!service || service.status !== 'active') throw new Error('Service is not available');
  if (service.provider.status !== 'active' || !service.provider.vetted_at) throw new Error('Provider is not vetted');

  const dimensions = normalizeServiceDimensions(service.categoryKey, input.quantityDimensions);
  const terms = await resolveCommercialTerms(db, service, context.projectId);
  const now = Date.now();
  if (Number.isNaN(input.scheduledStart.getTime()) || input.scheduledStart.getTime() <= now) {
    throw new Error('scheduledStart must be in the future');
  }
  if (input.scheduledStart.getTime() - now < terms.leadTimeHours * 60 * 60 * 1000) {
    throw new Error(`This service needs ${terms.leadTimeHours}h advance notice`);
  }

  let totalThb: number;
  let priceBreakdown: Record<string, unknown>;
  let quoteVersionId: string | undefined;
  if (service.priceModel === 'quote') {
    if (!input.quoteVersionId) throw new Error('This service requires an accepted quote version');
    const quote = await db.serviceQuoteVersion.findUnique({
      where: { id: input.quoteVersionId },
      include: { request: true },
    });
    if (
      !quote ||
      quote.request.serviceId !== service.id ||
      quote.request.ordererIdentityId !== input.ordererIdentityId ||
      quote.acceptedAt == null ||
      quote.expiresAt <= new Date() ||
      quote.request.projectId !== context.projectId
    ) throw new Error('Quote version is not valid for this order');
    totalThb = quote.totalThb;
    priceBreakdown = quote.priceBreakdown as Record<string, unknown>;
    quoteVersionId = quote.id;
  } else {
    if (!terms.basePriceThb || terms.basePriceThb <= 0) throw new Error('Service has no sellable price');
    const billedQuantity = billingQuantity(service.priceModel, dimensions);
    totalThb = terms.basePriceThb * billedQuantity;
    priceBreakdown = {
      base_thb: terms.basePriceThb,
      price_model: service.priceModel,
      billed_quantity: billedQuantity,
      dimensions,
      total_thb: totalThb,
    };
  }

  const durationHours = service.priceModel === 'per_hour' ? dimensions.hours ?? 1 : 1;
  const durationMs = (service.durationMin ?? 60) * 60 * 1000 * durationHours;
  const scheduledEnd = new Date(input.scheduledStart.getTime() + durationMs);
  const compatibilityQuantity = Math.max(1, billingQuantity(service.priceModel, dimensions));

  const order = await db.serviceOrder.create({
    data: {
      service_id: service.id,
      provider_id: service.provider_id,
      project_id: context.projectId,
      unit_id: context.unitId,
      booking_id: input.bookingId,
      orderer_identity_id: input.ordererIdentityId,
      orderer_role: input.ordererRole,
      scheduled_start: input.scheduledStart,
      scheduled_end: scheduledEnd,
      quantity: compatibilityQuantity,
      serviceContext: context.serviceContext as any,
      quantityDimensions: dimensions as any,
      price_breakdown: priceBreakdown as any,
      total_thb: totalThb,
      take_rate_pct_snapshot: terms.takeRatePct,
      termsSnapshot: terms.snapshot as any,
      quoteVersionId,
      status: 'placed',
      note_to_provider: input.noteToProvider,
      address_note: context.serviceContext.address,
    },
  });

  await notifyProviderMembers(db, service.provider_id, {
    type: 'order_new',
    titleKey: 'order.new.title',
    bodyKey: 'order.new.body',
    params: { order_id: order.id, service_title: service.title },
  });
  await track(db, 'service_order_placed', {
    serviceOrderId: order.id,
    projectId: context.projectId ?? undefined,
    unitId: context.unitId,
    bookingId: input.bookingId,
    identityId: input.ordererIdentityId,
    totalThb,
    standalone: context.projectId == null,
  });
  return order;
}

export async function createServiceQuoteRequest(
  db: PrismaClient,
  input: Omit<CanonicalServiceOrderInput, 'scheduledStart'>
) {
  const context = await resolveOrderContext(db, { ...input, scheduledStart: new Date(Date.now() + 60_000) });
  const service = await db.service.findUnique({ where: { id: input.serviceId } });
  if (!service || service.status !== 'active' || service.priceModel !== 'quote') {
    throw new Error('Service is not available for quote requests');
  }
  const dimensions = normalizeServiceDimensions(service.categoryKey, input.quantityDimensions);
  return db.serviceQuoteRequest.create({
    data: {
      serviceId: service.id,
      projectId: context.projectId,
      ordererIdentityId: input.ordererIdentityId,
      serviceContext: context.serviceContext as any,
      quantityDimensions: dimensions as any,
      status: 'open',
    },
  });
}

export async function addServiceQuoteVersion(
  db: PrismaClient,
  input: {
    requestId: string;
    providerId: string;
    totalThb: number;
    priceBreakdown: Record<string, unknown>;
    terms: Record<string, unknown>;
    expiresAt: Date;
  }
) {
  if (!Number.isInteger(input.totalThb) || input.totalThb < 0) throw new Error('Quote total must be a non-negative integer');
  if (input.expiresAt <= new Date()) throw new Error('Quote must expire in the future');
  return db.$transaction(async (tx) => {
    const request = await tx.serviceQuoteRequest.findUnique({ where: { id: input.requestId }, include: { service: true } });
    if (!request || request.status !== 'open') throw new Error('Quote request is not open');
    if (request.service.provider_id !== input.providerId) throw new Error('Only the service provider can quote this request');
    const latest = await tx.serviceQuoteVersion.aggregate({ where: { requestId: request.id }, _max: { version: true } });
    return tx.serviceQuoteVersion.create({
      data: {
        requestId: request.id,
        version: (latest._max.version ?? 0) + 1,
        providerId: input.providerId,
        totalThb: input.totalThb,
        priceBreakdown: input.priceBreakdown as any,
        termsSnapshot: input.terms as any,
        expiresAt: input.expiresAt,
      },
    });
  });
}

export async function acceptServiceQuoteVersion(
  db: PrismaClient,
  input: { quoteVersionId: string; ordererIdentityId: string; scheduledStart: Date; ordererRole: RoleType; noteToProvider?: string }
) {
  return db.$transaction(async (tx) => {
    const quote = await tx.serviceQuoteVersion.findUnique({
      where: { id: input.quoteVersionId },
      include: { request: { include: { service: true } } },
    });
    if (!quote || quote.request.ordererIdentityId !== input.ordererIdentityId) throw new Error('Quote not found');
    if (quote.acceptedAt) throw new Error('Quote version is already accepted');
    if (quote.expiresAt <= new Date()) throw new Error('Quote has expired');
    const accepted = await tx.serviceQuoteVersion.findFirst({ where: { requestId: quote.requestId, acceptedAt: { not: null } } });
    if (accepted) throw new Error('Another quote version has already been accepted');
    await tx.serviceQuoteVersion.update({ where: { id: quote.id }, data: { acceptedAt: new Date() } });
    await tx.serviceQuoteRequest.update({ where: { id: quote.requestId }, data: { status: 'accepted' } });
    return createCanonicalServiceOrder(tx as unknown as PrismaClient, {
      serviceId: quote.request.serviceId,
      projectId: quote.request.projectId,
      ordererIdentityId: input.ordererIdentityId,
      ordererRole: input.ordererRole,
      scheduledStart: input.scheduledStart,
      serviceContext: quote.request.serviceContext as ServiceContext,
      quantityDimensions: quote.request.quantityDimensions as QuantityDimensions,
      quoteVersionId: quote.id,
      noteToProvider: input.noteToProvider,
    });
  });
}
