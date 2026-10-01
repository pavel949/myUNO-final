import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { requireAdmin } from '@/app/libs/onboardingGuard';
import { prisma } from '@/lib/prisma';

const SOURCE = 'myuno_property_submission_v1';
type ReviewAction = 'start_review' | 'request_changes' | 'approve';

const transitions: Record<ReviewAction, { from: string[]; to: string }> = {
  start_review: { from: ['submitted'], to: 'under_review' },
  request_changes: { from: ['submitted', 'under_review'], to: 'changes_requested' },
  approve: { from: ['submitted', 'under_review'], to: 'approved' },
};

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  try {
    const body = await req.json();
    const action = String(body.action || '') as ReviewAction;
    if (!(action in transitions)) {
      return NextResponse.json({ error: 'Unknown review action' }, { status: 400 });
    }
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 2000) : '';
    if (action === 'request_changes' && !note) {
      return NextResponse.json(
        { error: 'Tell the applicant what needs to change.' },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM crm_opportunity WHERE id = ${params.id} FOR UPDATE`;
      const application = await tx.crmOpportunity.findUnique({
        where: { id: params.id },
        select: { id: true, source: true, requirements: true },
      });
      if (!application || application.source !== SOURCE) {
        throw new Error('Application not found');
      }
      const current = application.requirements as Record<string, unknown>;
      const currentStatus = String(current.status || 'draft');
      const transition = transitions[action];
      if (!transition.from.includes(currentStatus)) {
        throw new Error(`Cannot ${action.replace(/_/g, ' ')} from ${currentStatus}.`);
      }

      const at = new Date().toISOString();
      const history = Array.isArray(current.reviewHistory)
        ? current.reviewHistory
        : [];
      const requirements = {
        ...current,
        status: transition.to,
        reviewNote: action === 'request_changes' ? note : null,
        reviewedAt: at,
        reviewHistory: [
          ...history,
          {
            action,
            from: currentStatus,
            to: transition.to,
            note: note || null,
            at,
            actorIdentityId: guard.actorIdentityId,
          },
        ],
      };

      await tx.crmOpportunity.update({
        where: { id: application.id },
        data: { requirements: requirements as Prisma.InputJsonValue },
      });
      await tx.auditLog.create({
        data: {
          actorIdentityId: guard.actorIdentityId,
          action: `property_submission:${action}`,
          entityType: 'CrmOpportunity',
          entityId: application.id,
          data: {
            from: currentStatus,
            to: transition.to,
            hasNote: Boolean(note),
          },
        },
      });

      return { status: transition.to, reviewNote: requirements.reviewNote };
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Review update failed' },
      { status: 400 }
    );
  }
}
