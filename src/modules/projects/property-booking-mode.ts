import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { assertPropertyCapabilityForUnit, PropertyCapabilityError } from '@/modules/core/property-capability-access';
import { getPropertyReadiness } from './property-readiness';

type Db = PrismaClient | Prisma.TransactionClient;
type Scope = 'unit' | 'category';
export interface BookingModePreviewInput { unitId: string; actorIdentityId: string; scope: Scope; instantBook: boolean }
export interface BookingModeApplyInput extends BookingModePreviewInput { baseline: string; requestId: string }
const select = { id: true, name: true, projectId: true, inventoryCategoryId: true, instantBook: true, status: true, updatedAt: true } as const;
function validate(input: BookingModePreviewInput) {
  if (typeof input.unitId !== 'string' || !input.unitId || input.unitId.length > 200 ||
    !['unit', 'category'].includes(input.scope) || typeof input.instantBook !== 'boolean')
    throw new PropertyCapabilityError('Invalid booking mode request', 400);
}
async function targets(db: Db, input: BookingModePreviewInput, lock: boolean) {
  validate(input);
  const first = await assertPropertyCapabilityForUnit(db, input.actorIdentityId, 'booking_mode_editor', input.unitId);
  const categoryId = first.unit.inventoryCategoryId;
  if (input.scope === 'category' && !categoryId) throw new PropertyCapabilityError('This unit has no category', 409);
  if (lock && input.scope === 'category') {
    // A category FOR UPDATE lock also blocks FK additions while the exact set is applied.
    await db.$queryRaw`SELECT id FROM inventory_category WHERE id = ${categoryId} FOR UPDATE`;
  }
  const initial = input.scope === 'category'
    ? await db.unit.findMany({ where: { inventoryCategoryId: categoryId, status: { not: 'offboarded' } }, select, orderBy: { id: 'asc' } })
    : [await db.unit.findUniqueOrThrow({ where: { id: input.unitId }, select })];
  if (!initial.length || initial.length > 500) throw new PropertyCapabilityError('Choose a category with at most 500 active units', 409);
  if (lock) {
    const ids = initial.map(unit => unit.id).sort();
    await db.$queryRaw`SELECT id FROM unit WHERE id = ANY(${ids}::text[]) ORDER BY id FOR UPDATE`;
  }
  const units = lock ? await db.unit.findMany({ where: { id: { in: initial.map(unit => unit.id) } }, select, orderBy: { id: 'asc' } }) : initial;
  if (units.length !== initial.length || !units.some(unit => unit.id === input.unitId)) throw new PropertyCapabilityError('Inventory changed. Preview again.', 409);
  for (const unit of units) {
    if (unit.projectId !== first.unit.projectId || (input.scope === 'category' && unit.inventoryCategoryId !== categoryId))
      throw new PropertyCapabilityError('Category membership changed. Preview again.', 409);
    await assertPropertyCapabilityForUnit(db, input.actorIdentityId, 'booking_mode_editor', unit.id, lock);
  }
  const baseline = createHash('sha256').update(JSON.stringify({ scope: input.scope, instantBook: input.instantBook,
    categoryId: input.scope === 'category' ? categoryId : null,
    units: units.map(unit => [unit.id, unit.projectId, unit.inventoryCategoryId, unit.instantBook, unit.status, unit.updatedAt.toISOString()]) })).digest('hex');
  return { units, baseline };
}

async function readiness(db: Db, units: Awaited<ReturnType<typeof targets>>['units'], instantBook: boolean) {
  if (!instantBook) return [];
  const reports = new Map<string, Awaited<ReturnType<typeof getPropertyReadiness>>>();
  const blocked = [];
  for (const unit of units) {
    if (!reports.has(unit.projectId)) reports.set(unit.projectId, await getPropertyReadiness(db, unit.projectId));
    const report = reports.get(unit.projectId);
    const row = await db.unit.findUnique({ where: { id: unit.id }, select: {
      status: true, permittedUseConfirmedAt: true, project: { select: { status: true } },
    } });
    const codes = [...new Set([...(report?.blockers.filter(item => item.scope === 'project' || item.unitId === unit.id).map(item => item.key) ?? ['readiness.unavailable']),
      ...(!row || row.status !== 'live' || row.project.status !== 'live' ? ['inventory.not_live'] : []),
      ...(!row?.permittedUseConfirmedAt ? ['unit.permitted_use'] : [])])];
    if (codes.length) blocked.push({ unitId: unit.id, name: unit.name, codes });
  }
  return blocked;
}

export async function previewPropertyBookingMode(db: Db, input: BookingModePreviewInput) {
  const { units, baseline } = await targets(db, input, false);
  return { scope: input.scope, instantBook: input.instantBook, baseline,
    units: units.map(unit => ({ id: unit.id, name: unit.name, instantBook: unit.instantBook })),
    blocked: await readiness(db, units, input.instantBook) };
}

/** The only fields mutated here are Unit.instantBook and its automatic version, plus audit. */
export async function applyPropertyBookingMode(db: PrismaClient, input: BookingModeApplyInput) {
  validate(input);
  if (!/^[a-f0-9]{64}$/.test(input.baseline) || !/^[a-zA-Z0-9-]{8,120}$/.test(input.requestId))
    throw new PropertyCapabilityError('A reviewed preview and request ID are required', 400);
  return db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`booking-mode:${input.actorIdentityId}:${input.requestId}`}))`;
    // Even idempotent retries require currently valid authority over every original target.
    const current = await targets(tx, input, true);
    const receipt = await tx.auditLog.findFirst({ where: { actorIdentityId: input.actorIdentityId,
      action: 'units.booking_mode_applied', entityType: 'Unit', entityId: input.unitId,
      data: { path: ['requestId'], equals: input.requestId } } });
    if (receipt) {
      const data = receipt.data as Record<string, unknown>;
      if (data.baseline !== input.baseline || data.instantBook !== input.instantBook || data.scope !== input.scope)
        throw new PropertyCapabilityError('Request ID was already used for another change', 409);
      const priorIds = data.unitIds;
      if (!Array.isArray(priorIds) || priorIds.length !== current.units.length ||
        priorIds.some((id, index) => id !== current.units[index].id)) throw new PropertyCapabilityError('Inventory changed after the original apply', 409);
      if (current.units.some(unit => unit.instantBook !== input.instantBook))
        throw new PropertyCapabilityError('Booking mode changed after the original apply. Refresh before editing.', 409);
      return { updated: current.units.length, instantBook: input.instantBook, alreadyApplied: true };
    }
    if (input.baseline !== current.baseline) throw new PropertyCapabilityError('This preview is stale. Review the affected units again.', 409);
    const blocked = await readiness(tx, current.units, input.instantBook);
    if (blocked.length) throw new PropertyCapabilityError('Instant booking prerequisites are incomplete. Review readiness before enabling it.', 409);
    for (const unit of current.units) {
      if (unit.instantBook === input.instantBook) continue;
      const result = await tx.unit.updateMany({ where: { id: unit.id, updatedAt: unit.updatedAt }, data: { instantBook: input.instantBook } });
      if (result.count !== 1) throw new PropertyCapabilityError('Unit changed. Preview again.', 409);
    }
    await tx.auditLog.create({ data: { actorIdentityId: input.actorIdentityId, action: 'units.booking_mode_applied',
      entityType: 'Unit', entityId: input.unitId, data: { requestId: input.requestId, baseline: input.baseline,
        scope: input.scope, instantBook: input.instantBook, unitIds: current.units.map(unit => unit.id),
        before: current.units.map(unit => ({ id: unit.id, instantBook: unit.instantBook })),
      } as Prisma.InputJsonValue } });
    return { updated: current.units.length, instantBook: input.instantBook, alreadyApplied: false };
  }, { timeout: 30_000 });
}
