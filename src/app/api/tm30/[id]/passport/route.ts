/**
 * GET /api/tm30/[id]/passport?reason=...
 * Get passport data for a TM30 filing. Staff/admin only — never MC/juristic
 * (board 19's permission matrix, one of its two absolutes) — and only with
 * a stated reason, which requirePassportAccess both requires and audit-logs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import {
  decryptPassportNumber,
  safeDecrypt,
  buildTm30AddressBlock,
  TM30_IMMIGRATION_PORTAL_URL,
} from '@/modules/ops';
import { requirePassportAccess } from '@/modules/core';
import { canViewTm30PassportDetails } from '@/app/libs/projectScope';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.identityId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the filing
    const filing = await prisma.tm30Filing.findUnique({
      where: { id: params.id },
      include: {
        booking: {
          include: {
            unit: true,
            project: { select: { address: true, name: true } },
          },
        },
        bookingGuest: true,
        filedBy: true,
      },
    });

    if (!filing) {
      return NextResponse.json({ error: 'Filing not found' }, { status: 404 });
    }

    if (!canViewTm30PassportDetails(user, { projectId: filing.booking.projectId })) {
      return NextResponse.json(
        { error: 'Only staff or admin may access passport data' },
        { status: 403 }
      );
    }

    const identity = await prisma.identity.findUnique({ where: { id: user.identityId } });
    if (!identity) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const reason = req.nextUrl.searchParams.get('reason') ?? undefined;
    const access = await requirePassportAccess({
      identity,
      subjectIdentityId: filing.booking.guestIdentityId,
      entityType: 'tm30_filing',
      entityId: filing.id,
      reason,
      resource: { unitId: filing.booking.unitId, projectId: filing.booking.projectId },
    });
    if (!access.ok) {
      return NextResponse.json(
        {
          error:
            access.error === 'reason_required'
              ? 'State a reason before viewing this passport.'
              : 'Only staff or admin may access passport data',
          code: access.error,
        },
        { status: access.error === 'reason_required' ? 400 : 403 }
      );
    }

    // Decrypt passport for response
    const decryptedPassport = filing.bookingGuest?.passportNumber
      ? decryptPassportNumber(filing.bookingGuest.passportNumber)
      : null;

    const addressBlock = buildTm30AddressBlock({
      unitName: filing.booking.unit.name,
      addressSupplement: filing.booking.unit.addressSupplement,
      projectAddress: filing.booking.project?.address,
    });

    return NextResponse.json(
      {
        id: filing.id,
        guestName: safeDecrypt(filing.bookingGuest?.fullName),
        nationality: filing.bookingGuest?.nationality,
        passportNumber: decryptedPassport,
        dateOfBirth: safeDecrypt(filing.bookingGuest?.dateOfBirth),
        unitName: filing.booking.unit.name,
        projectName: filing.booking.project?.name,
        addressBlock,
        portalUrl: TM30_IMMIGRATION_PORTAL_URL,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Passport fetch error:', error);
    return NextResponse.json(
      { error: 'Fetch failed' },
      { status: 500 }
    );
  }
}
