import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { createReservationGroup } from '@/modules/booking/reservation-group.service';
import { blockingBookingConditions } from '@/modules/core/booking-occupancy';
import { reviewedGroupForContext, reviewedGuestKey, type WorkbookReviewContext, type ReviewedWorkbookGroupEntry } from './reviewed-workbook';

const day = (value: string) => new Date(value + 'T00:00:00Z');
export function groupProtectionMatches(blocks: Array<{ id: string; externalRef: string | null; reason: string; note: string | null; updatedAt: Date; startDate: Date; endDate: Date }>,
  placement: ReviewedWorkbookGroupEntry['placements'][number], entry: Pick<ReviewedWorkbookGroupEntry,'startDate'|'endDate'>): boolean {
  const expected = placement.block;
  if (expected === null) return blocks.length === 0;
  return blocks.length === 1 && blocks[0].id === expected.id && blocks[0].externalRef === expected.externalRef &&
    blocks[0].reason === expected.reason && blocks[0].note === expected.note &&
    blocks[0].updatedAt.toISOString() === new Date(expected.updatedAt!).toISOString() &&
    blocks[0].startDate.toISOString().slice(0,10) === entry.startDate && blocks[0].endDate.toISOString().slice(0,10) === entry.endDate;
}

/** The only imported group writer. No Booking/Payment/Ledger/notification is created.
 * Existing BlockedDate rows remain the one canonical availability authority.
 */
export async function applyReviewedImportedGroup(db: PrismaClient, input: {
  systemId: string; environment: string; review: WorkbookReviewContext; actorIdentityId: string;
}) {
  return db.$transaction(async tx => {
    const actor = await tx.identity.findUnique({ where: { id: input.actorIdentityId }, select: { isAdmin: true, status: true } });
    if (!actor?.isAdmin || actor.status !== 'active') throw new Error('IMPORTED_GROUP_ADMIN_REQUIRED');
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.systemId + ':group:' + input.review.ref}))`;
    await tx.$queryRaw`SELECT id FROM external_system WHERE id=${input.systemId} FOR UPDATE`;
    const system = await tx.externalSystem.findUniqueOrThrow({ where: { id: input.systemId } });
    const config = system.config as Record<string, unknown>;
    if (system.environment !== input.environment || !['active','staging'].includes(system.status) ||
        config.bookingAuthority !== 'myuno' || config.cutoverVerified !== true) throw new Error('IMPORTED_GROUP_AUTHORITY_CHANGED');
    const { entry, manifest } = reviewedGroupForContext(config, input.review);
    const existing = await tx.importedReservationSource.findUnique({
      where: { externalSystemId_sourceReference: { externalSystemId: system.id, sourceReference: entry.ref } },
      include: { placements: { include: { blockedDate: true } } },
    });
    if (existing) {
      if (existing.sourceRowDigest !== entry.rowDigest || existing.quotedTotalThb !== entry.totalSatang ||
          existing.placements.length !== entry.placements.length || existing.placements.some(p => !entry.placements.some(e =>
            e.unitId === p.unitId && e.unitCode === p.sourceUnitCode && p.blockedDate.startDate.getTime() === day(entry.startDate).getTime() &&
            p.blockedDate.endDate.getTime() === day(entry.endDate).getTime()))) throw new Error('IMPORTED_GROUP_SOURCE_CHANGED');
      return { status: 'duplicate' as const, sourceId: existing.id, groupId: existing.reservationGroupId, placements: existing.placements.length };
    }
    const unitIds = entry.placements.map(p => p.unitId).sort();
    for (const id of unitIds) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
    let projectId: string | undefined;
    const matchedBlocks: Array<string | null> = [];
    for (const placement of entry.placements) {
      const mapping = await tx.externalMapping.findFirst({ where: { external_system_id: system.id, entity_type: 'unit',
        external_id: placement.unitExternalId, internal_id: placement.unitId } });
      const metadata = mapping?.metadata as Record<string, unknown> | null;
      if (!mapping || !(metadata?.verified === true || (metadata?.operational_verification === 'confirmed' && metadata?.cutover_verified === true)))
        throw new Error('IMPORTED_GROUP_UNIT_MAPPING_CHANGED');
      const unit = await tx.unit.findUniqueOrThrow({ where: { id: placement.unitId }, select: { projectId: true, status: true } });
      if (unit.status === 'offboarded' || projectId && projectId !== unit.projectId) throw new Error('IMPORTED_GROUP_UNIT_SCOPE_INVALID');
      projectId = unit.projectId;
      if (placement.block) await tx.$queryRaw`SELECT id FROM blocked_date WHERE id=${placement.block.id} FOR UPDATE`;
      const blocks = await tx.blockedDate.findMany({ where: { unitId: placement.unitId,
        startDate: { lt: day(entry.endDate) }, endDate: { gt: day(entry.startDate) } } });
      if (!groupProtectionMatches(blocks, placement, entry) || blocks.some(b => b.propertyDealId !== null))
        throw new Error('IMPORTED_GROUP_PROTECTION_CHANGED');
      if (placement.block && await tx.importedReservationPlacement.findUnique({ where: { blockedDateId: placement.block.id } }))
        throw new Error('IMPORTED_GROUP_PROTECTION_ALREADY_LINKED');
      if (await tx.booking.findFirst({ where: { unitId: placement.unitId, startDate: { lt: day(entry.endDate) },
        endDate: { gt: day(entry.startDate) }, OR: blockingBookingConditions() } })) throw new Error('IMPORTED_GROUP_BOOKING_CONFLICT');
      // Do not introduce unresolved source money underneath an existing financial close.
      if (await tx.ownerStatement.findFirst({ where: { unitId: placement.unitId, status: { not: 'superseded' },
        periodStart: { lt: day(entry.endDate) }, periodEnd: { gte: day(entry.startDate) } } }))
        throw new Error('IMPORTED_GROUP_EXISTING_STATEMENT_REQUIRES_REVIEW');
      matchedBlocks.push(blocks[0]?.id ?? null);
    }
    const guestKey = reviewedGuestKey(entry.ref);
    const guestMap = await tx.externalMapping.findFirst({ where: { external_system_id: system.id, entity_type: 'guest', external_id: guestKey } });
    let guestId = guestMap?.internal_id;
    if (!guestId) {
      const words = entry.guestName.trim().split(/\s+/);
      const guest = await tx.identity.create({ data: { firstName: words[0], lastName: words.slice(1).join(' ') || '-', status: 'invited' } });
      guestId = guest.id;
      await tx.externalMapping.create({ data: { external_system_id: system.id, entity_type: 'guest', external_id: guestKey,
        internal_id: guestId, metadata: { source: 'reviewed_operator_group', verified: true } } });
    }
    const group = await createReservationGroup(tx, { guestIdentityId: guestId, createdByIdentityId: input.actorIdentityId,
      title: entry.ref, currency: 'THB', notes: entry.operationalDetails?.notes });
    const source = await tx.importedReservationSource.create({ data: {
      externalSystemId: system.id, sourceReference: entry.ref, reservationGroupId: group.id, projectId: projectId!,
      sourceRowDigest: entry.rowDigest, workbookSha256: manifest.workbookSha256, quotedTotalThb: entry.totalSatang,
      currency: 'THB', sourcePaymentStatus: entry.rawStatus, reportedPaidThb: entry.reportedPaidSatang,
      adults: entry.adults, children: entry.children,
      sourceEvidence: { provenance: manifest.provenance, sourceSnapshot: manifest.sourceSnapshot,
        operationalDetails: entry.operationalDetails ?? {}, reviewedEntry: entry,
        reviewDigest: input.review.manifestDigest, monetaryMeaning: 'source_quote_only_not_receipt' } as unknown as Prisma.InputJsonValue,
    } });
    for (const [i, placement] of entry.placements.entries()) {
      const blockId = matchedBlocks[i] ?? (await tx.blockedDate.create({ data: {
        unitId: placement.unitId, startDate: day(entry.startDate), endDate: day(entry.endDate), reason: 'ota_import',
        externalRef: 'layantara:group:' + source.id + ':' + placement.unitId,
        note: 'Imported group reservation; per-villa financial allocation unresolved.', createdByIdentityId: input.actorIdentityId,
      } })).id;
      await tx.importedReservationPlacement.create({ data: { sourceId: source.id, unitId: placement.unitId,
        blockedDateId: blockId, sourceUnitCode: placement.unitCode, allocatedTotalThb: null } });
    }
    await tx.externalMapping.create({ data: { external_system_id: system.id, entity_type: 'reservation_group', external_id: entry.ref,
      internal_id: group.id, metadata: { importedSourceId: source.id, allocation: 'unknown' } } });
    await tx.externalEventInbox.create({ data: { external_system_id: system.id,
      event_id: 'wb-group-' + createHash('sha256').update(entry.ref + ':' + entry.rowDigest).digest('hex').slice(0,40),
      aggregate_type: 'reservation_group', aggregate_external_id: entry.ref, event_type: 'workbook.group_imported',
      occurred_at: new Date(), payload: { sourceId: source.id, review: input.review } as unknown as Prisma.InputJsonValue,
      payload_hash: entry.rowDigest, status: 'processed', processed_at: new Date() } });
    await tx.auditLog.create({ data: { actorIdentityId: input.actorIdentityId, action: 'layantara.group_imported',
      entityType: 'ReservationGroup', entityId: group.id, data: { sourceId: source.id, placements: entry.placements.length,
        allocation: 'unknown', receiptsCreated: 0 } } });
    return { status: 'processed' as const, sourceId: source.id, groupId: group.id, placements: entry.placements.length };
  }, { timeout: 15000, maxWait: 10000 });
}

/** Complete group scope is required; never reveal unrelated guests via one villa. */
export async function listImportedGroupsForUnits(db: PrismaClient, unitIds: string[]) {
  if (!unitIds.length) return [];
  return db.importedReservationSource.findMany({ where: { placements: {
    some: { unitId: { in: unitIds } }, every: { unitId: { in: unitIds } },
  } }, include: { reservationGroup: { select: { title: true, notes: true, guest: { select: { firstName: true, lastName: true } } } },
    placements: { include: { unit: { select: { name: true } }, blockedDate: { select: { startDate: true, endDate: true } } } } },
    orderBy: { createdAt: 'desc' }, take: 100 });
}
