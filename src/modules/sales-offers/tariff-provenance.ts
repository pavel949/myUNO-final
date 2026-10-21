import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
type Db = PrismaClient | Prisma.TransactionClient;
/** Change this version when canonical pricing semantics change. Existing reviews fail closed. */
export const SALES_PRICING_CONTRACT = 'canonical-stay-2026-10-21-v1';
export function stableHash(value: unknown): string {
  const normalize = (v: unknown): unknown => {
    if (v instanceof Date) return v.toISOString();
    if (Array.isArray(v)) return v.map(normalize);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, val]) => [k, normalize(val)]));
    return v;
  };
  return createHash('sha256').update(JSON.stringify(normalize(value))).digest('hex');
}
/** Full canonical rule/config scope, including defaults and overrides. No external runtime reads. */
export async function tariffFingerprint(db: Db, unitId: string) {
  const unit = await db.unit.findUniqueOrThrow({ where: { id: unitId }, include: { inventoryCategory: true,
    project: { select: { id: true, status: true, timezone: true, projectType: true } } } });
  const [offers, plans, rules, defaults, overrides] = await Promise.all([
    db.commercialOffering.findMany({ where: { unitId }, orderBy: { id: 'asc' } }),
    db.ratePlan.findMany({ where: { OR: [{ unitId }, { categoryId: unit.inventoryCategoryId ?? '' }, { projectId: unit.projectId }] }, orderBy: { id: 'asc' } }),
    db.pricingRule.findMany({ where: { unitId }, orderBy: { id: 'asc' } }),
    db.configParameter.findMany({ where: { OR: ['pricing.', 'finance.', 'cancellation.', 'booking.'].map(prefix => ({ key: { startsWith: prefix } })) }, orderBy: { key: 'asc' } }),
    db.configOverride.findMany({ where: { OR: [{ scopeType: 'global' }, { scopeType: 'project', scopeId: unit.projectId }, { scopeType: 'unit', scopeId: unitId }] }, orderBy: { id: 'asc' } }),
  ]);
  // No names, owner identity, marketing media or PII participate in rule approval.
  const { inventoryCategory, project } = unit;
  return stableHash({ contract: SALES_PRICING_CONTRACT, offers, plans, rules, defaults, overrides,
    inventoryCategory, project, unit: { id: unit.id, inventoryCategoryId: unit.inventoryCategoryId,
      status: unit.status, assetStatus: unit.assetStatus, categoryKey: unit.categoryKey,
      baseNightlyThb: unit.baseNightlyThb, minNights: unit.minNights, maxGuests: unit.maxGuests,
      petsAllowed: unit.petsAllowed, maxPets: unit.maxPets, cancellationPolicyKey: unit.cancellationPolicyKey } });
}
