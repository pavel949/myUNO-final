import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/app/libs/onboardingGuard';
import { logAudit } from '@/modules/audit';
import { updateRegulatoryCredential } from '@/modules/compliance';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  try {
    const body = await req.json();

    const credential = await updateRegulatoryCredential(prisma, params.id, {
      status: body.status || undefined,
      registrationNumber: body.registrationNumber !== undefined ? body.registrationNumber : undefined,
      issuingAuthority: body.issuingAuthority !== undefined ? body.issuingAuthority : undefined,
      legalHolderName: body.legalHolderName !== undefined ? body.legalHolderName : undefined,
      issueDate: body.issueDate ? new Date(body.issueDate) : undefined,
      effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : undefined,
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined,
      exemptionBasis: body.exemptionBasis !== undefined ? body.exemptionBasis : undefined,
      notes: body.notes !== undefined ? body.notes : undefined,
      evidenceMediaId: body.evidenceMediaId || undefined,
      verifiedByIdentityId: guard.actorIdentityId,
    });

    await logAudit({
      actorIdentityId: guard.actorIdentityId,
      action: 'compliance:regulatory_credential_updated',
      entityType: 'RegulatoryCredential',
      entityId: credential.id,
      data: { status: credential.status },
    });

    return NextResponse.json({ credential });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update the credential' },
      { status: 400 }
    );
  }
}
