import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/app/libs/onboardingGuard';
import { logAudit } from '@/modules/audit';
import { createRegulatoryCredential, listRegulatoryCredentials } from '@/modules/compliance';

export const dynamic = 'force-dynamic';

/**
 * Admin writer for jurisdictional regulatory credentials — the piece Q71
 * found missing: the commercial-eligibility engine had real check logic but
 * nothing to check. Admin-only per the 2026-09-29 founder ruling.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  const url = new URL(req.url);
  const projectId = url.searchParams.get('projectId') || undefined;
  const unitId = url.searchParams.get('unitId') || undefined;
  const organizationId = url.searchParams.get('organizationId') || undefined;

  const credentials = await listRegulatoryCredentials(prisma, { projectId, unitId, organizationId });

  return NextResponse.json({
    credentials: credentials.map((c) => ({
      id: c.id,
      credentialType: c.credentialType,
      scopeLevel: c.scopeLevel,
      jurisdictionCountry: c.jurisdictionCountry,
      organizationId: c.organizationId,
      organizationName: c.organization?.name ?? null,
      projectId: c.projectId,
      projectName: c.project?.name ?? null,
      unitId: c.unitId,
      unitName: c.unit?.name ?? null,
      registrationNumber: c.registrationNumber,
      issuingAuthority: c.issuingAuthority,
      legalHolderName: c.legalHolderName,
      issueDate: c.issueDate?.toISOString() ?? null,
      effectiveDate: c.effectiveDate?.toISOString() ?? null,
      expiryDate: c.expiryDate?.toISOString() ?? null,
      status: c.status,
      evidenceMediaId: c.evidenceMediaId,
      exemptionBasis: c.exemptionBasis,
      notes: c.notes,
      verifiedAt: c.verifiedAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  try {
    const body = await req.json();
    if (!body.credentialType || !body.scopeLevel) {
      return NextResponse.json(
        { error: 'credentialType and scopeLevel are required' },
        { status: 400 }
      );
    }

    const credential = await createRegulatoryCredential(prisma, {
      requirementKey: body.requirementKey,
      jurisdictionCountry: body.jurisdictionCountry,
      credentialType: body.credentialType,
      scopeLevel: body.scopeLevel,
      organizationId: body.organizationId || undefined,
      projectId: body.projectId || undefined,
      unitId: body.unitId || undefined,
      registrationNumber: body.registrationNumber || undefined,
      issuingAuthority: body.issuingAuthority || undefined,
      legalHolderName: body.legalHolderName || undefined,
      issueDate: body.issueDate ? new Date(body.issueDate) : undefined,
      effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : undefined,
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined,
      status: body.status || undefined,
      exemptionBasis: body.exemptionBasis || undefined,
      notes: body.notes || undefined,
      evidenceMediaId: body.evidenceMediaId || undefined,
      verifiedByIdentityId: guard.actorIdentityId,
    });

    await logAudit({
      actorIdentityId: guard.actorIdentityId,
      action: 'compliance:regulatory_credential_created',
      entityType: 'RegulatoryCredential',
      entityId: credential.id,
      data: {
        credentialType: credential.credentialType,
        scopeLevel: credential.scopeLevel,
        projectId: credential.projectId,
        unitId: credential.unitId,
        organizationId: credential.organizationId,
        status: credential.status,
      },
    });

    return NextResponse.json({ credential }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to record the credential' },
      { status: 400 }
    );
  }
}
