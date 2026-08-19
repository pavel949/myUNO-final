import { PrismaClient, ComplianceRecordStatus, ComplianceRecordType } from '@prisma/client';

export interface CreateComplianceRecordInput {
  unitId: string;
  recordType: ComplianceRecordType;
  expiresOn?: Date;
  mediaId?: string;
  notes?: string;
  label?: string;
}

export interface UpdateComplianceRecordInput {
  status?: ComplianceRecordStatus;
  expiresOn?: Date;
  mediaId?: string;
  notes?: string;
  label?: string;
  verifiedAt?: Date;
  verifiedByIdentityId?: string;
}

/**
 * Create a compliance record for a unit.
 * Records: permitted_use (legal gate), insurance, license, title_audit, other.
 * Status defaults to pending; confirmed on `permitted_use` unlocks permitted_use_confirmed_at.
 */
export async function createComplianceRecord(
  db: PrismaClient,
  input: CreateComplianceRecordInput
): Promise<{ id: string }> {
  const { unitId, recordType, expiresOn, mediaId, notes, label } = input;

  // Verify unit exists
  const unit = await db.unit.findUnique({
    where: { id: unitId },
  });

  if (!unit) {
    throw new Error(`Unit ${unitId} not found`);
  }

  const record = await db.complianceRecord.create({
    data: {
      unitId,
      recordType,
      status: 'pending',
      expiresOn,
      mediaId,
      notes,
      label,
    },
  });

  return { id: record.id };
}

/**
 * Update a compliance record.
 * If status transitions to confirmed on a permitted_use record,
 * also set Unit.permitted_use_confirmed_at if not already set.
 */
export async function updateComplianceRecord(
  db: PrismaClient,
  recordId: string,
  input: UpdateComplianceRecordInput
): Promise<void> {
  const { status, expiresOn, mediaId, notes, label, verifiedAt, verifiedByIdentityId } = input;

  const record = await db.complianceRecord.findUnique({
    where: { id: recordId },
    include: { unit: true },
  });

  if (!record) {
    throw new Error(`ComplianceRecord ${recordId} not found`);
  }

  // Update the record
  await db.complianceRecord.update({
    where: { id: recordId },
    data: {
      status,
      expiresOn,
      mediaId,
      notes,
      label,
      verifiedAt,
      verifiedByIdentityId,
    },
  });

  // If this is a permitted_use record transitioning to confirmed, unlock the unit's permitted_use_confirmed_at
  if (record.recordType === 'permitted_use' && status === 'confirmed' && !record.unit.permittedUseConfirmedAt) {
    await db.unit.update({
      where: { id: record.unitId },
      data: {
        permittedUseConfirmedAt: new Date(),
      },
    });
  }
}

/**
 * Get a compliance record with full details.
 */
export async function getComplianceRecord(
  db: PrismaClient,
  recordId: string
): Promise<any> {
  const record = await db.complianceRecord.findUnique({
    where: { id: recordId },
    include: {
      unit: true,
      media: true,
      verifiedBy: true,
    },
  });

  if (!record) {
    throw new Error(`ComplianceRecord ${recordId} not found`);
  }

  return record;
}

/**
 * Get all compliance records for a unit.
 */
export async function getUnitComplianceRecords(
  db: PrismaClient,
  unitId: string
): Promise<any[]> {
  return await db.complianceRecord.findMany({
    where: { unitId },
    include: {
      media: true,
      verifiedBy: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Delete a compliance record (admin only).
 */
export async function deleteComplianceRecord(
  db: PrismaClient,
  recordId: string
): Promise<void> {
  const record = await db.complianceRecord.findUnique({
    where: { id: recordId },
  });

  if (!record) {
    throw new Error(`ComplianceRecord ${recordId} not found`);
  }

  await db.complianceRecord.delete({
    where: { id: recordId },
  });
}

/**
 * Check if a unit can proceed past a mobilization checklist gate.
 * Returns { canProceed: boolean, reason?: string }
 */
export async function checkMobilizationGate(
  db: PrismaClient,
  unitId: string,
  step: string
): Promise<{ canProceed: boolean; reason?: string }> {
  const unit = await db.unit.findUnique({
    where: { id: unitId },
    include: {
      engagements: true,
      complianceRecords: true,
    },
  });

  if (!unit) {
    throw new Error(`Unit ${unitId} not found`);
  }

  // Gates for each step
  if (step === 'mandate') {
    // Gate: no further steps until engagement is active
    const activeEngagement = unit.engagements.find((e: any) => e.status === 'active');
    if (!activeEngagement) {
      return { canProceed: false, reason: 'Engagement must be active before proceeding' };
    }
    return { canProceed: true };
  }

  if (step === 'legal_audit') {
    // Gate: no gate before legal_audit, but after it requires permitted_use confirmed
    return { canProceed: true };
  }

  if (step === 'golive_checklist') {
    // Gate: requires permitted_use ComplianceRecord confirmed
    const permittedUseRecord = unit.complianceRecords.find(
      (r: any) => r.recordType === 'permitted_use' && r.status === 'confirmed'
    );
    if (!permittedUseRecord) {
      return { canProceed: false, reason: 'Permitted use compliance record must be confirmed' };
    }
    return { canProceed: true };
  }

  return { canProceed: true };
}

/**
 * Mark a mobilization checklist item as done.
 * If step is golive_checklist, flip unit to live.
 */
export async function completeMobilizationStep(
  db: PrismaClient,
  checklistItemId: string,
  completedByIdentityId: string,
  notes?: string
): Promise<void> {
  const item = await db.mobilizationChecklistItem.findUnique({
    where: { id: checklistItemId },
    include: { unit: true },
  });

  if (!item) {
    throw new Error(`MobilizationChecklistItem ${checklistItemId} not found`);
  }

  // Check gate before allowing completion
  const gateCheck = await checkMobilizationGate(db, item.unitId, item.step);
  if (!gateCheck.canProceed) {
    throw new Error(`Cannot complete step: ${gateCheck.reason}`);
  }

  // Go-live needs every other step finished — checked *before* anything is
  // written. This used to mark the step done first and throw afterwards, with
  // no transaction to undo it: a refused go-live left `golive_checklist`
  // ticked while the unit stayed draft, so the screen said the unit was ready
  // and it was not. Refusing before writing keeps the record honest.
  if (item.step === 'golive_checklist') {
    const siblings = await db.mobilizationChecklistItem.findMany({
      where: { unitId: item.unitId, id: { not: checklistItemId } },
    });

    const allDone = siblings.every((i) => i.status === 'done' || i.status === 'skipped');
    if (!allDone) {
      throw new Error('All checklist items must be completed before going live');
    }
  }

  // The tick and the go-live are one act: a unit must never be live with its
  // final step unrecorded, nor the step recorded without the unit live.
  await db.$transaction(async (tx) => {
    await tx.mobilizationChecklistItem.update({
      where: { id: checklistItemId },
      data: {
        status: 'done',
        completedAt: new Date(),
        completedByIdentityId,
        notes,
      },
    });

    if (item.step === 'golive_checklist') {
      await tx.unit.update({
        where: { id: item.unitId },
        data: { status: 'live' },
      });
    }
  });
}

/**
 * Get the mobilization checklist for a unit with current status.
 */
export async function getUnitMobilizationChecklist(
  db: PrismaClient,
  unitId: string
): Promise<any[]> {
  return await db.mobilizationChecklistItem.findMany({
    where: { unitId },
    orderBy: {
      step: 'asc', // Preserve order: qualify, mandate, legal_audit, condition_survey, standards_uplift, pricing_setup, golive_checklist
    },
  });
}

/**
 * Check if all mobilization checklist items are done.
 */
export async function isMobilizationComplete(
  db: PrismaClient,
  unitId: string
): Promise<boolean> {
  const items = await getUnitMobilizationChecklist(db, unitId);
  return items.every((item: any) => item.status === 'done' || item.status === 'skipped');
}

/**
 * Initialize mobilization checklist for a unit (called on unit creation).
 */
/** The seven steps of doc 07 F-OWN-1, in the order the gate enforces. */
export const MOBILIZATION_STEPS = [
  'qualify',
  'mandate',
  'legal_audit',
  'condition_survey',
  'standards_uplift',
  'pricing_setup',
  'golive_checklist',
] as const;

/**
 * Give a unit its checklist.
 *
 * Idempotent: `@@unique([unitId, step])` means a second call would otherwise
 * throw, and this is now reachable from a route where a double-click or a retry
 * after a partial failure must repair rather than fail. `skipDuplicates` also
 * makes it safe to run against a unit whose checklist was partly created.
 */
export async function initializeMobilizationChecklist(
  db: PrismaClient,
  unitId: string
): Promise<{ created: number }> {
  const { count } = await db.mobilizationChecklistItem.createMany({
    data: MOBILIZATION_STEPS.map((step) => ({ unitId, step, status: 'pending' as const })),
    skipDuplicates: true,
  });
  return { created: count };
}
