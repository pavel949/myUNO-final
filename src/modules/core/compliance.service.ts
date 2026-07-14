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

  // Update the checklist item
  await db.mobilizationChecklistItem.update({
    where: { id: checklistItemId },
    data: {
      status: 'done',
      completedAt: new Date(),
      completedByIdentityId,
      notes,
    },
  });

  // If this is the go-live step, flip unit to live
  if (item.step === 'golive_checklist') {
    // First verify all checklist items are done
    const allItems = await db.mobilizationChecklistItem.findMany({
      where: { unitId: item.unitId },
    });

    const allDone = allItems.every((i: any) => i.status === 'done' || i.status === 'skipped');
    if (!allDone) {
      throw new Error('All checklist items must be completed before going live');
    }

    // Flip unit to live
    await db.unit.update({
      where: { id: item.unitId },
      data: {
        status: 'live',
      },
    });
  }
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
export async function initializeMobilizationChecklist(
  db: PrismaClient,
  unitId: string
): Promise<void> {
  const steps = [
    'qualify',
    'mandate',
    'legal_audit',
    'condition_survey',
    'standards_uplift',
    'pricing_setup',
    'golive_checklist',
  ];

  for (const step of steps) {
    await db.mobilizationChecklistItem.create({
      data: {
        unitId,
        step: step as any,
        status: 'pending',
      },
    });
  }
}
