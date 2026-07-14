/**
 * POST /api/ledger/record-cost
 * Record a manual cost entry in the unit ledger (F-OPS-3).
 * Staff/host with project scope required. Creates append-only LedgerEntry.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { recordCost } from '@/modules/finance';
import { LedgerEntryType } from '@prisma/client';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.identityId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { unitId, entryType, amountThb, occurredOn, description, receiptMediaId } = body;

    // Validate required fields
    if (!unitId || !entryType || typeof amountThb !== 'number' || !occurredOn || !description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate entryType is a valid cost type (manual entries only)
    const manualEntryTypes: LedgerEntryType[] = [
      'cleaning_cost',
      'maintenance_cost',
      'consumables_cost',
      'utilities_cost',
      'adjustment',
    ];

    if (!manualEntryTypes.includes(entryType)) {
      return NextResponse.json({ error: `Invalid entry type for manual recording: ${entryType}` }, { status: 400 });
    }

    // Verify user has scope to the unit's project
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { projectId: true },
    });

    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    // Check permission: staff_ops or owner of the unit
    const isOwner = await prisma.roleAssignment.findFirst({
      where: {
        identityId: user.identityId,
        projectId: unit.projectId,
        role: 'owner',
      },
    });

    const isStaff = await prisma.roleAssignment.findFirst({
      where: {
        identityId: user.identityId,
        projectId: unit.projectId,
        role: { in: ['staff_ops', 'onsite_host'] },
      },
    });

    if (!isOwner && !isStaff) {
      return NextResponse.json({ error: 'Insufficient scope' }, { status: 403 });
    }

    const entry = await recordCost(prisma, {
      unitId,
      entryType,
      amountThb,
      occurredOn: new Date(occurredOn),
      description,
      receiptMediaId,
      recordedByIdentityId: user.identityId,
    });

    return NextResponse.json(
      {
        id: entry.id,
        entryType: entry.entryType,
        amountThb: entry.amountThb,
        unitId: entry.unitId,
        description: entry.description,
        occurredOn: entry.occurredOn,
        createdAt: entry.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Record cost error:', error);
    return NextResponse.json({ error: 'Recording cost failed' }, { status: 500 });
  }
}
