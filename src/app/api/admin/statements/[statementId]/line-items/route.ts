import { NextRequest, NextResponse } from 'next/server';
import { LineItemCategory } from '@prisma/client';
import { requireAdmin, failed } from '@/app/libs/onboardingGuard';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface LineItemView {
  id: string;
  category: LineItemCategory;
  description: string;
  amountThb: number;
  bookingId: string | null;
  supportingDocumentId: string | null;
  createdAt: string;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { statementId: string } }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  try {
    const statement = await prisma.ownerStatement.findUnique({
      where: { id: params.statementId },
      include: {
        unit: { select: { id: true, name: true, projectId: true } },
        lineItems: {
          orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!statement) {
      return NextResponse.json({ error: 'Statement not found' }, { status: 404 });
    }

    const lineItems: LineItemView[] = statement.lineItems.map((item) => ({
      id: item.id,
      category: item.category,
      description: item.description,
      amountThb: item.amountTh,
      bookingId: item.bookingId,
      supportingDocumentId: item.supportingDocumentId,
      createdAt: item.createdAt.toISOString(),
    }));

    const groupedByCategory: Partial<Record<LineItemCategory, LineItemView[]>> = {};
    const totals: Partial<Record<LineItemCategory, number>> = {};

    for (const item of lineItems) {
      const group = groupedByCategory[item.category] ?? [];
      group.push(item);
      groupedByCategory[item.category] = group;
      totals[item.category] = (totals[item.category] ?? 0) + item.amountThb;
    }

    return NextResponse.json({
      success: true,
      statement: {
        id: statement.id,
        unitId: statement.unitId,
        unitName: statement.unit.name,
        periodStart: statement.periodStart.toISOString(),
        periodEnd: statement.periodEnd.toISOString(),
        grossBookingsAmountThb: statement.grossBookingsAmountTh,
        guestPaymentsReceivedThb: statement.guestPaymentsReceivedTh,
        serviceFeesAmountThb: statement.serviceFeesAmountTh,
        operatingExpensesAmountThb: statement.operatingExpensesAmountTh,
        taxesAmountThb: statement.taxesAmountTh,
        adjustedNoiThb: statement.adjustedNoiTh,
        distributableCashThb: statement.distributableCashTh,
        performanceFeeAmountThb: statement.performanceFeeAmountTh,
        performanceFeeBasisText: statement.performanceFeeBasisText,
        status: statement.status,
      },
      lineItems,
      groupedByCategory,
      totals,
    });
  } catch (error) {
    console.error('[STATEMENT LINE ITEMS]', error);
    return failed(error, 'Internal server error');
  }
}
