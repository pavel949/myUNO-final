import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createComplianceRecord, getUnitComplianceRecords } from '@/modules/core';
import { requireAction, failed } from '@/app/libs/onboardingGuard';
import { logAudit } from '@/modules/audit';

/**
 * A unit's compliance records — the legal audit step of doc 07 F-OWN-1.
 *
 * Read and write access are intentionally separated. The permission matrix
 * gives owner/MC roles read-only visibility for compliance records; mutation
 * requires an explicit `allow` grant so a read permission cannot become a
 * legal-record write capability.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAction('compliance:manage_compliance_records', {
    requiredAccess: 'read',
    unitId: params.id,
  });
  if (!guard.ok) return guard.error;

  const records = await getUnitComplianceRecords(prisma, params.id);
  return NextResponse.json({ records });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAction('compliance:manage_compliance_records', {
    requiredAccess: 'allow',
    unitId: params.id,
  });
  if (!guard.ok) return guard.error;

  try {
    const body = await req.json();
    if (!body.recordType) {
      return NextResponse.json({ error: 'recordType is required' }, { status: 400 });
    }

    const record = await createComplianceRecord(prisma, {
      unitId: params.id,
      recordType: body.recordType,
      label: body.label,
      notes: body.notes,
      mediaId: body.mediaId,
      expiresOn: body.expiresOn ? new Date(body.expiresOn) : undefined,
    });

    await logAudit({
      actorIdentityId: guard.actorIdentityId,
      action: 'compliance:record_created',
      entityType: 'ComplianceRecord',
      entityId: record.id,
      data: { unitId: params.id, recordType: body.recordType },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    return failed(error, 'Failed to record the compliance document');
  }
}
