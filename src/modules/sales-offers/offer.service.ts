import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { computeCanonicalPriceBreakdown } from '@/modules/core/canonical-pricing.service';
import { checkAvailability, StayUnquotableError } from '@/modules/core';
import { excludedSourceControlledUnits } from '@/modules/booking/source-authority';
import { createBookingAttempt, findBookingByCreationIntent, resolveStayCancellationPolicy, sourceSeasonCancellationPolicy } from '@/modules/booking';
import { bookingCreationIntent } from '@/modules/booking/creation-intent';
import { getScopedOperationalAccess } from '@/modules/ops/operating-space-access.service';
import { canUseReservationGuest, RESERVATION_DEPARTMENTS } from '@/modules/ops/reservation-guests.service';
import { tariffFingerprint, stableHash } from './tariff-provenance';
import { OfferError, parseStay, type GuestOption, type GuestOffer, type OfferLocale, type StayInput } from './contracts';

type Db = PrismaClient | Prisma.TransactionClient;
const accessFor = (db: Db, actor: string, space: string) => getScopedOperationalAccess(db, actor, space, 'manage_reservations', RESERVATION_DEPARTMENTS);
const dbClient = (db: Db) => db as PrismaClient;
function json(value: unknown) { return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue; }

export async function quoteOption(db: Db, unitId: string, stay: StayInput) {
  const unit = await db.unit.findUniqueOrThrow({ where: { id: unitId }, select: {
    name: true, bedrooms: true, maxGuests: true, amenityKeys: true, status: true, assetStatus: true,
    project: { select: { name: true, status: true } }, inventoryCategory: { select: { status: true } },
    commercialOfferings: { where: { status: 'active', offeringType: { in: ['short_term_stay','short_stay','long_term_rental'] } }, select: { pricingTerms: true } },
    coverMedia: { select: { storageKey: true, kind: true, encrypted: true, deleteAfter: true } },
  } });
  const declaredCurrencies = unit.commercialOfferings.flatMap(o => {const t=o.pricingTerms;return t && typeof t==='object' && !Array.isArray(t) && typeof t.currency==='string' ? [t.currency.toUpperCase()] : [];});
  const currency = declaredCurrencies.find(c=>c!=='THB') ?? 'THB';
  const fingerprint = await tariffFingerprint(db, unitId);
  const image = unit.coverMedia;
  // Marketing image only; never deliver private evidence or signed/query-bearing URLs.
  const safeImage = image && image.kind === 'photo' && !image.encrypted && !image.deleteAfter &&
    /^https:\/\//.test(image.storageKey) && !/[?#@]/.test(image.storageKey) ? image.storageKey : null;
  const snapshot: GuestOption = { name: unit.name, property: unit.project.name, bedrooms: unit.bedrooms,
    maxGuests: unit.maxGuests, amenities: unit.amenityKeys, image: safeImage, stay,
    state: 'review_required', currency, ruleVersion: null, price: null, terms: null };
  const start = new Date(stay.startDate), end = new Date(stay.endDate);
  const [available, excluded] = await Promise.all([
    checkAvailability(dbClient(db), unitId, start, end), excludedSourceControlledUnits(db, [unitId]),
  ]);
  if (!available || excluded.length || unit.status !== 'live' || unit.project.status !== 'live' ||
    unit.inventoryCategory?.status !== 'live' || unit.assetStatus === 'suspended') {
    snapshot.state = 'unavailable';
    return { snapshot, fingerprint, validationId: null };
  }
  if(currency!=='THB')return { snapshot, fingerprint, validationId: null };
  const validations = await db.salesTariffValidation.findMany({ where: { unitId, fingerprint,
    revokedAt: null, expiresAt: { gt: new Date() }, validFrom: { lte: start }, validThrough: { gte: end },
    currency: 'THB' }, take: 2 });
  // Explicit independent review is required even when the existing engine returns a number.
  if (validations.length !== 1 || !validations[0].evidenceRef.trim() || !validations[0].ruleVersion.trim())
    return { snapshot, fingerprint, validationId: null };
  const validation = validations[0];
  let price;
  try {
    price = await computeCanonicalPriceBreakdown(dbClient(db), unitId, start, end, stay.adults + stay.children, new Date(), stay.pets, { freshConfig: true });
  } catch (error) {
    // Only commercial validation failures are partial results. DB/operational faults must remain retryable errors.
    if (error instanceof Error && (error instanceof StayUnquotableError || /tariff|booking policy|booking terms|source booking|season|minimum|exceeds/i.test(error.message)))
      return { snapshot, fingerprint, validationId: null };
    throw error;
  }
  if (!Number.isSafeInteger(price.total_thb) || price.total_thb <= 0) return { snapshot, fingerprint, validationId: null };
  const cancellation = sourceSeasonCancellationPolicy(price.commercialTerms) ??
    await resolveStayCancellationPolicy(dbClient(db), { unitId }, { fresh: true });
  if (await tariffFingerprint(db, unitId) !== fingerprint) throw new OfferError('RULES_CHANGED');
  snapshot.state = 'ready'; snapshot.ruleVersion = validation.ruleVersion;
  snapshot.price = { nights: price.lines.map(l => ({ date: l.date, amount: l.nightly_thb })),
    subtotal: price.subtotal_thb, cleaning: price.cleaning_fee_thb, service: price.service_fee_thb,
    tax: price.occupancy_tax_thb, losDiscount: price.los_discount_thb, earlyDiscount: price.early_bird_discount_thb, total: price.total_thb, inclusions: price.tariffInclusions ?? null };
  const terms = price.commercialTerms;
  snapshot.terms = { cancellation, payment: terms ? `${terms.confirmationPaymentType}: ${terms.confirmationPaymentValue}` : null,
    balance: terms?.balanceTiming ?? null, minimumNights: terms?.minimumNights ?? null, amendmentsAllowed: terms?.amendmentsAllowed ?? null,
    securityDeposit: terms ? {thbSatang:terms.securityDepositThbSatang,usdCents:terms.securityDepositUsdCents} : null, included: terms?.included ?? [], excluded: terms?.excluded ?? [], stayTerms: terms?.stayTerms ?? null };
  return { snapshot, fingerprint, validationId: validation.id };
}

export async function searchOffers(db: PrismaClient, actor: string, spaceId: string, input: unknown) {
  const stay = parseStay(input);
  const access = await accessFor(db, actor, spaceId);
  const filters = input as { bedrooms?: number; budget?: number; query?: string };
  if (filters.bedrooms !== undefined && (!Number.isInteger(filters.bedrooms) || filters.bedrooms < 0 || filters.bedrooms > 100)) throw new OfferError('INVALID_INPUT', 400);
  if (filters.budget !== undefined && (!Number.isSafeInteger(filters.budget) || filters.budget < 0)) throw new OfferError('INVALID_INPUT', 400);
  const units = await db.unit.findMany({ where: { id: { in: access.unitIds }, status: { not: 'offboarded' },
    ...(filters.bedrooms ? { bedrooms: { gte: filters.bedrooms } } : {}), maxGuests: { gte: stay.adults + stay.children },
    ...(typeof filters.query === 'string' && filters.query.trim() ? { OR: [{ name: { contains: filters.query.slice(0, 100), mode: 'insensitive' } }, { project: { name: { contains: filters.query.slice(0, 100), mode: 'insensitive' } } }] } : {}),
  }, select: { id: true }, orderBy: [{ project: { name: 'asc' } }, { name: 'asc' }], take: 51 });
  const results = [];
  // Bounded sequential engine calls keep large portfolios from exhausting the connection pool.
  for (const unit of units.slice(0, 50)) {
    const { snapshot } = await quoteOption(db, unit.id, stay);
    if (!filters.budget || !snapshot.price || snapshot.price.total <= filters.budget)
      results.push({ unitId: unit.id, ...snapshot });
  }
  return { results, truncated: units.length > 50 };
}

export async function createOffer(db: PrismaClient, actor: string, input: {
  spaceId: string; selections: { unitId: string; stay: StayInput }[]; locale: OfferLocale;
  expiresAt: string; clientNote?: string; previousId?: string; commandId: string;
}) {
  if (!/^[0-9a-f-]{36}$/i.test(input.commandId) || !['en', 'ru', 'th'].includes(input.locale) ||
    !Array.isArray(input.selections) || input.selections.length < 1 || input.selections.length > 4 ||
    new Set(input.selections.map(s => s.unitId)).size !== input.selections.length ||
    typeof (input.clientNote ?? '') !== 'string' || (input.clientNote?.length ?? 0) > 2000) throw new OfferError('INVALID_INPUT', 400);
  const expiry = new Date(input.expiresAt);
  if (!Number.isFinite(expiry.getTime()) || expiry <= new Date() || expiry.getTime() > Date.now() + 30 * 86400000) throw new OfferError('INVALID_EXPIRY', 400);
  for (const selection of input.selections) selection.stay = parseStay(selection.stay);
  return db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'sales-command:' + input.commandId}))`;
    const access = await accessFor(tx, actor, input.spaceId);
    if (!input.selections.every(s => access.unitIds.includes(s.unitId))) throw new OfferError('FORBIDDEN', 403);
    const replay = await tx.salesOffer.findUnique({ where: { id: input.commandId }, include: { options: true } });
    if (replay) {
      if (replay.createdByIdentityId !== actor || replay.operatingSpaceId !== input.spaceId ||
        replay.locale !== input.locale || replay.clientNote !== (input.clientNote?.trim() ?? '') || replay.expiresAt.getTime() !== expiry.getTime() ||
        stableHash(replay.options.sort((a,b) => a.position - b.position).map(o => ({ unitId: o.unitId, stay: (o.snapshot as unknown as GuestOption).stay }))) !== stableHash(input.selections))
        throw new OfferError('INTENT_CONFLICT');
      return { id: replay.id, version: replay.version };
    }
    const previous = input.previousId ? await readOffer(tx, actor, input.previousId) : null;
    if (previous && previous.operatingSpaceId !== input.spaceId) throw new OfferError('FORBIDDEN', 403);
    const seriesId = previous?.seriesId ?? randomUUID();
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'sales-series:' + seriesId}))`;
    const latest = await tx.salesOffer.findFirst({ where: { seriesId }, orderBy: { version: 'desc' } });
    if (previous && latest?.id !== previous.id) throw new OfferError('STALE_VERSION');
    const author = await tx.identity.findUniqueOrThrow({ where: { id: actor }, select: { firstName: true, lastName: true } });
    const options = [];
    for (const [position, selection] of input.selections.entries()) {
      const quote = await quoteOption(tx, selection.unitId, selection.stay);
      options.push({ unitId: selection.unitId, position, fingerprint: quote.fingerprint,
        validationId: quote.validationId, snapshot: json(quote.snapshot) });
    }
    const offer = await tx.salesOffer.create({ data: { id: input.commandId, seriesId, version: (previous?.version ?? 0) + 1,
      operatingSpaceId: input.spaceId, createdByIdentityId: actor, locale: input.locale, expiresAt: expiry,
      salespersonName: `${author.firstName} ${author.lastName}`.trim(), clientNote: input.clientNote?.trim() ?? '', options: { create: options } } });
    await tx.auditLog.create({ data: { actorIdentityId: actor, action: 'sales_offer:created', entityType: 'SalesOffer', entityId: offer.id,
      data: { operatingSpaceId: input.spaceId, version: offer.version } } });
    return { id: offer.id, version: offer.version };
  }, { timeout: 30000 });
}

export async function readOffer(db: Db, actor: string, id: string) {
  const offer = await db.salesOffer.findUnique({ where: { id }, include: { options: { orderBy: { position: 'asc' } } } });
  if (!offer) throw new OfferError('NOT_FOUND', 404);
  const access = await accessFor(db, actor, offer.operatingSpaceId);
  if (!offer.options.length || !offer.options.every(o => access.unitIds.includes(o.unitId))) throw new OfferError('FORBIDDEN', 403);
  return offer;
}

export function guestProjection(offer: Awaited<ReturnType<typeof readOffer>>): GuestOffer {
  // Snapshot schema is written only by quoteOption; top-level staff/relational fields never cross this seam.
  return { version: offer.version, locale: offer.locale as OfferLocale, expiresAt: offer.expiresAt.toISOString(),
    salesperson: offer.salespersonName, clientNote: offer.clientNote,
    options: offer.options.map(o => sanitizeOption(o.snapshot as unknown as GuestOption)) };
}

/** Explicit recursive field projection: future staff fields cannot silently become public. */
export function sanitizeOption(o: GuestOption): GuestOption {
  return {
    name: o.name, property: o.property, bedrooms: o.bedrooms, maxGuests: o.maxGuests,
    amenities: o.amenities.map(s => String(s)), image: o.image,
    stay: { startDate: o.stay.startDate, endDate: o.stay.endDate, adults: o.stay.adults, children: o.stay.children, pets: o.stay.pets },
    state: o.state, currency: o.currency, ruleVersion: o.ruleVersion,
    price: o.price ? { nights: o.price.nights.map(n => ({date:n.date,amount:n.amount})), subtotal:o.price.subtotal,
      cleaning:o.price.cleaning, service:o.price.service, tax:o.price.tax, losDiscount:o.price.losDiscount,
      earlyDiscount:o.price.earlyDiscount, total:o.price.total, inclusions: o.price.inclusions ? {taxes:o.price.inclusions.taxes,serviceCharge:o.price.inclusions.serviceCharge,breakfast:o.price.inclusions.breakfast} : null } : null,
    terms: o.terms ? { cancellation: { name:o.terms.cancellation.name, steps:o.terms.cancellation.steps.map(s => ({days_before_checkin:s.days_before_checkin,refund_pct:s.refund_pct})) },
      payment:o.terms.payment, balance:o.terms.balance, minimumNights:o.terms.minimumNights, amendmentsAllowed:o.terms.amendmentsAllowed, securityDeposit:o.terms.securityDeposit ? {thbSatang:o.terms.securityDeposit.thbSatang,usdCents:o.terms.securityDeposit.usdCents} : null, included:o.terms.included.map(String), excluded:o.terms.excluded.map(String), stayTerms:o.terms.stayTerms } : null,
  };
}

export async function revalidateOffer(db: Db, actor: string, id: string) {
  const offer = await readOffer(db, actor, id);
  if (offer.expiresAt <= new Date()) throw new OfferError('OFFER_EXPIRED');
  const latest = await db.salesOffer.findFirst({ where: { seriesId: offer.seriesId }, orderBy: { version: 'desc' }, select: { id: true } });
  if (latest?.id !== offer.id) throw new OfferError('STALE_VERSION');
  for (const option of offer.options) {
    const stored = option.snapshot as unknown as GuestOption;
    parseStay(stored.stay);
    const fresh = await quoteOption(db, option.unitId, stored.stay);
    if (stored.state !== 'ready' || fresh.snapshot.state !== 'ready' || fresh.validationId !== option.validationId ||
      fresh.fingerprint !== option.fingerprint || stableHash(fresh.snapshot.price) !== stableHash(stored.price) ||
      stableHash(fresh.snapshot.terms) !== stableHash(stored.terms)) throw new OfferError('REVALIDATION_REQUIRED');
  }
  return offer;
}

export async function requestOfferBooking(db: PrismaClient, actor: string, id: string, optionId: string, guestId: string) {
  const offer = await readOffer(db, actor, id);
  const access = await accessFor(db, actor, offer.operatingSpaceId);
  const option = offer.options.find(o => o.id === optionId);
  if (!option || !await canUseReservationGuest(db, guestId, offer.operatingSpaceId, access.unitIds, access.isAdmin)) throw new OfferError('FORBIDDEN', 403);
  const guest = await db.identity.findUnique({ where: { id: guestId }, select: { status: true } });
  if (guest?.status !== 'active') throw new OfferError('INVALID_GUEST', 400);
  const snapshot = option.snapshot as unknown as GuestOption, stay = snapshot.stay;
  const unit = await db.unit.findUniqueOrThrow({ where: { id: option.unitId }, select: { projectId: true } });
  // Deterministic creation identity permits recovery after expiry or a successful write + lost response.
  const hex = stableHash([id, optionId, guestId]);
  const key = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
  const creationIntent = bookingCreationIntent(key, { unitId: option.unitId, projectId: unit.projectId,
    startDate: new Date(stay.startDate), endDate: new Date(stay.endDate), adults: stay.adults, children: stay.children,
    infants: 0, pets: stay.pets, instantBook: false, paymentMethod: 'cash' });
  const previous = await findBookingByCreationIntent(db, guestId, creationIntent);
  if (previous) return { id: previous.id, status: previous.status, replayed: true };
  await revalidateOffer(db, actor, id);
  const policy = snapshot.terms!.cancellation;
  const result = await createBookingAttempt(db, { unitId: option.unitId, projectId: unit.projectId, guestIdentityId: guestId,
    bookingType: 'guest_stay', channel: 'manual', startDate: new Date(stay.startDate), endDate: new Date(stay.endDate),
    adults: stay.adults, children: stay.children, pets: stay.pets, totalThb: 0, acceptedMaxTotalThb: snapshot.price!.total,
    instantBook: false, creationIntent, offerReference: { offerId: offer.id, version: offer.version, optionId: option.id }, cancellationPolicySnapshot: json(policy) as Record<string, unknown>, suppressRequestNotifications: true,
    validateBeforeCreate: async (tx, authoritative) => {
      await revalidateOffer(tx, actor, id);
      if (authoritative.total_thb !== snapshot.price!.total) throw new OfferError('REVALIDATION_REQUIRED');
    },
  });
  return { id: result.booking.id, status: result.booking.status, replayed: result.replayed };
}
