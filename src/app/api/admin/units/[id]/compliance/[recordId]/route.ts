import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateComplianceRecord } from '@/modules/core';
import { logAudit } from '@/modules/audit';
import { requireAction, failed } from '@/app/libs/onboardingGuard';

/**
 * Confirm (or correct) one compliance record.
 *
 * Mutation requires an explicit `allow` grant. Owner/MC read-only grants must
 * not be sufficient to attest or alter legal/compliance evidence.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; recordId: string } }
) {
  const guard = await requireAction('compliance:manage_compliance_records', {
    requiredAccess: 'allow',
    unitId: params.id,
  });
  if (!guard.ok) return guard.error;

  try {
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
