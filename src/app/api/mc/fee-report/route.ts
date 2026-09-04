import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMCFeeReport } from '@/modules/projects';
import { requireMcMember } from '@/app/libs/mcGuard';
import { handleError } from '@/app/libs/errorHandler';

/**
 * GET /api/mc/fee-report — platform fee report for an MC portfolio context (F-MC-2).
 *
 * Query: projectId, organizationId, periodStart (ISO), periodEnd (ISO, exclusive).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const organizationId = searchParams.get('organizationId');
    const periodStartRaw = searchParams.get('periodStart');
    const periodEndRaw = searchParams.get('periodEnd');

    if (!projectId || !organizationId || !periodStartRaw || !periodEndRaw) {
      return NextResponse.json(
        { error: 'Missing required query params: projectId, organizationId, periodStart, periodEnd' },
        { status: 400 }
      );
    }

    const periodStart = new Date(periodStartRaw);
    const periodEnd = new Date(periodEndRaw);
    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
      return NextResponse.json({ error: 'Invalid periodStart or periodEnd' }, { status: 400 });
    }
    if (periodEnd <= periodStart) {
      return NextResponse.json({ error: 'periodEnd must be after periodStart' }, { status: 400 });
    }

    const { user } = await requireMcMember({ projectId, organizationId });

    const report = await getMCFeeReport(
      prisma,
      user.identityId,
      projectId,
      organizationId,
      periodStart,
      periodEnd
    );

    return NextResponse.json({
      organizationId: report.organizationId,
      periodStart: report.periodStart.toISOString(),
      periodEnd: report.periodEnd.toISOString(),
      feeLines: report.feeLines.map((line) => ({
        ...line,
        date: line.date instanceof Date ? line.date.toISOString() : line.date,
      })),
      summaryThb: report.summaryThb,
    });
  } catch (error) {
    return handleError(error);
  }
}
