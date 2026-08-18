import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createComplianceRecord, getUnitComplianceRecords } from '@/modules/core';
import { requireAction, failed } from '@/app/libs/onboardingGuard';
import { logAudit } from '@/modules/audit';

/**
 * A unit's compliance records — the **legal audit** step of doc 07 F-OWN-1.
 *
 * `createComplianceRecord` existed with no caller, while the owner dashboard
 * already *read* these records (`owner.service.ts`). So the platform showed a
 * compliance list nothing could add to.
 *
 * This matters beyond convenience: `permittedUseConfirmedAt` can be stamped
 * from the units screen, and that timestamp is what gates go-live. Until now a
 * unit could be marked cleared with no evidence recorded anywhere — which is
 * what ClearView's proof-of-evidence mandate exists to prevent. Whether
 * confirmation should be *refused* without a `permitted_use` record is a
 * tightening of a legal gate, so it is Q43 rather than something done here.
 *
 * Guarded on the doc 03 capability that already covers this — "Manage
 * compliance records (permitted use, licenses)".
 */

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAction('compliance:manage_compliance_records');
  if (!guard.ok) return guard.error;

  const records = await getUnitComplianceRecords(prisma, params.id);
  return NextResponse.json({ records });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAction('compliance:manage_compliance_records');
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
