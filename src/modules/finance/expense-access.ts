import type { Identity, PrismaClient } from '@prisma/client';
import { can } from '@/modules/core';
import { OWNER_VISIBLE_STATEMENT_STATUSES } from './statement-signoff.service';

/**
 * Who may write a cost on a unit, and who may read the receipt for it.
 *
 * Decided live, on every call, from the database — never from a cached session
 * or a token: a role revoked a moment ago must already be refused.
 *
 * ## Write authority is per unit, not per project
 * `can()` answers "does this identity hold a role whose scope covers this
 * project". For `mc_member` that is not enough: an MC member is a member of ONE
 * management company, and `money:record_costs_on_units` is granted for
 * `their_units` (doc 03) — the units that company currently manages. Without
 * the second check, any MC member in a project could record costs on a
 * neighbour's villa. Staff (`staff_ops`) carry project authority and need no
 * such narrowing; admins are unconditional (and `can()` already says so).
 */

export interface ExpenseUnitRef {
  id: string;
  projectId: string;
}

type AccessDb = Pick<PrismaClient, 'roleAssignment' | 'unitEngagement' | 'statementLineItem'>;

const COST_ACTION = 'money:record_costs_on_units';

function scopeCoversUnit(
  assignment: { scopeType: string; projectId: string | null; unitId: string | null },
  unit: ExpenseUnitRef
): boolean {
  if (assignment.scopeType === 'platform') return true;
  if (assignment.scopeType === 'project') return assignment.projectId === unit.projectId;
  if (assignment.scopeType === 'unit') return assignment.unitId === unit.id;
  return false;
}

export async function canWriteUnitExpenses(
  db: AccessDb,
  identity: Identity,
  unit: ExpenseUnitRef,
  now: Date = new Date()
): Promise<boolean> {
  if (identity.status !== 'active') return false;

  const permitted = await can({
    identity,
    action: COST_ACTION,
    requiredAccess: 'allow',
    resource: { projectId: unit.projectId, unitId: unit.id },
  });
  if (!permitted) return false;
  if (identity.isAdmin) return true;

  const assignments = await db.roleAssignment.findMany({
    where: { identityId: identity.id, status: 'active', role: { in: ['staff_ops', 'mc_member'] } },
    select: { role: true, scopeType: true, projectId: true, unitId: true, organizationId: true },
  });
  const covering = assignments.filter((a) => scopeCoversUnit(a, unit));

  if (covering.some((a) => a.role === 'staff_ops')) return true;

  const organizationIds = covering
    .filter((a) => a.role === 'mc_member' && a.organizationId)
    .map((a) => a.organizationId as string);
  if (organizationIds.length === 0) return false;

  // The unit's CURRENT management mandate (half-open [start, end)) must belong
  // to the member's own company. Mirrors projects/engagement-scope, which the
  // projects barrel does not export.
  const managed = await db.unitEngagement.findFirst({
    where: {
      unitId: unit.id,
      engagementType: 'via_management_company',
      managementOrgId: { in: organizationIds },
      status: 'active',
      AND: [
        { OR: [{ startsOn: null }, { startsOn: { lte: now } }] },
        { OR: [{ endsOn: null }, { endsOn: { gt: now } }] },
      ],
    },
    select: { id: true },
  });
  return managed !== null;
}

export type ReceiptReader = 'operator' | 'owner';

/**
 * How, if at all, this identity may read a receipt.
 *
 * - `operator`: currently authorised to write costs on the receipt's unit.
 * - `owner`: the RECORDED RECIPIENT of a visible statement that cites this
 *   receipt. The recipient is the statement's own `ownerIdentityId`, so it holds
 *   after an ownership transfer or offboarding exactly as the statement itself
 *   does (owner-statement-visibility), and a draft — not yet visible — grants
 *   nothing. A receipt the statement does not cite is not theirs, whoever
 *   owns the unit today.
 *
 * Anything else is `null`, and the route answers 404 so existence is not
 * revealed.
 */
export async function resolveReceiptReader(
  db: AccessDb,
  identity: Identity,
  receipt: { id: string; unit: ExpenseUnitRef | null },
  now: Date = new Date()
): Promise<ReceiptReader | null> {
  if (identity.status !== 'active') return null;

  if (receipt.unit && (await canWriteUnitExpenses(db, identity, receipt.unit, now))) {
    return 'operator';
  }

  const cited = await db.statementLineItem.findFirst({
    where: {
      expenseReceiptId: receipt.id,
      statement: {
        ownerIdentityId: identity.id,
        status: { in: OWNER_VISIBLE_STATEMENT_STATUSES },
      },
    },
    select: { id: true },
  });
  return cited ? 'owner' : null;
}
