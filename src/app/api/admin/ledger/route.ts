/**
 * GET /api/admin/ledger
 * Browse ledger entries (admin only).
 * Query params: unitId, projectId, startDate, endDate, entryType
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.identityId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin role
    const isAdmin = await prisma.identity.findUnique({
      where: { id: user.identityId },
      select: { isAdmin: true },
    });

    if (!isAdmin?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const unitId = searchParams.get('unitId');
    const projectId = searchParams.get('projectId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const entryType = searchParams.get('entryType');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    const where: any = {};

    if (unitId) where.unitId = unitId;
    if (projectId) where.projectId = projectId;
    if (entryType) where.entryType = entryType;

    if (startDate || endDate) {
      where.occurredOn = {};
      if (startDate) where.occurredOn.gte = new Date(startDate);
      if (endDate) where.occurredOn.lte = new Date(endDate);
    }

    const entries = await prisma.ledgerEntry.findMany({
      where,
      include: {
        unit: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { occurredOn: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await prisma.ledgerEntry.count({ where });

    return NextResponse.json({
      entries: entries.map((e) => ({
        id: e.id,
        entryType: e.entryType,
        amountThb: e.amountThb,
        unitId: e.unitId,
        projectId: e.projectId,
        unit: e.unit,
        project: e.project,
        description: e.description,
        occurredOn: e.occurredOn.toISOString(),
        createdAt: e.createdAt.toISOString(),
        createdBy: e.createdBy,
        bookingId: e.bookingId,
        serviceOrderId: e.serviceOrderId,
      })),
      pagination: {
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Ledger browse error:', error);
    return NextResponse.json({ error: 'Ledger browse failed' }, { status: 500 });
  }
}
