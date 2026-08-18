import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateComplianceRecord } from '@/modules/core';
import { logAudit } from '@/modules/audit';
import { requireAction, failed } from '@/app/libs/onboardingGuard';

/**
 * Confirm (or correct) one compliance record.
 *
 * Records are created `pending`, and the go-live gate requires a **confirmed**
 * `permitted_use` record — so without this route the checklist could be started
 * and its documents attached, and the last step would still refuse forever.
 * Creating evidence and attesting to it are deliberately two acts.
 *
 * `updateComplianceRecord` also stamps `Unit.permittedUseConfirmedAt` when a
 * permitted-use record is confirmed, which is what closes the gap the audit
 * found: until now that timestamp could be set from the units screen with no
 * document behind it. Confirming the document is now a path that produces both.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; recordId: string } }
) {
  const guard = await requireAction('compliance:manage_compliance_records');
  if (!guard.ok) return guard.error;

  try {
    // Scoped to the unit in the path rather than fetched-then-checked.
    const record = await prisma.complianceRecord.findFirst({
      where: { id: params.recordId, unitId: params.id },
      select: { id: true, recordType: true },
    });
    if (!record) {
      return NextResponse.json({ error: 'Compliance record not found for this unit' }, { status: 404 });
    }

    const body = await req.json();
    await updateComplianceRecord(prisma, params.recordId, {
      status: body.status,
      label: body.label,
      notes: body.notes,
      mediaId: body.mediaId,
      expiresOn: body.expiresOn ? new Date(body.expiresOn) : undefined,
      verifiedByIdentityId: body.status === 'confirmed' ? guard.actorIdentityId : undefined,
    });

    await logAudit({
      actorIdentityId: guard.actorIdentityId,
      action: 'compliance:record_updated',
      entityType: 'ComplianceRecord',
      entityId: params.recordId,
      data: { unitId: params.id, recordType: record.recordType, status: body.status ?? null },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return failed(error, 'Failed to update the compliance record');
  }
}
