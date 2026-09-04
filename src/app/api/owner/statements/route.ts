import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { track } from '@/modules/analytics';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized. Authentication required.' }, { status: 401 });
    }

    const statements = await prisma.ownerStatement.findMany({
      where: {
        ownerIdentityId: currentUser.identityId,
        unit: {
          status: { not: 'offboarded' },
        },
      },
      include: {
        unit: {
          select: {
            id: true,
            name: true,
            projectId: true,
          },
        },
        ledgerEntries: {
          select: {
            entryType: true,
            amountThb: true,
          },
        },
      },
      orderBy: {
        periodEnd: 'desc',
      },
    });

    const transformed = statements.map((stmt) => ({
      id: stmt.id,
      periodStart: stmt.periodStart.toISOString(),
      periodEnd: stmt.periodEnd.toISOString(),
      status: stmt.status,
      unitId: stmt.unit.id,
      unitName: stmt.unit.name,
      projectId: stmt.unit.projectId,
      grossRevenueTh: stmt.grossRevenueTh,
      totalCostsTh: stmt.totalCostsTh,
      noiTh: stmt.noiTh,
      ownerShareTh: stmt.ownerShareTh,
      estateShareTh: stmt.estateShareTh,
      capApplied: stmt.capApplied,
      publishedAt: stmt.publishedAt?.toISOString() ?? null,
      createdAt: stmt.createdAt.toISOString(),
      ledgerEntryCount: stmt.ledgerEntries.length,
    }));

    for (const stmt of statements) {
      await track(prisma, 'owner_statement_viewed', {
        identityId: currentUser.identityId,
        statementId: stmt.id,
        unitId: stmt.unit.id,
        projectId: stmt.unit.projectId,
      }).catch(() => null);
    }

    return NextResponse.json({
      success: true,
      statements: transformed,
      count: transformed.length,
    });
  } catch (error) {
    console.error('[OWNER STATEMENTS]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
