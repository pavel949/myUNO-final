import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { canAccessMcMobilizationUnit } from '@/app/libs/projectScope';
import { getLabels } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { MOBILIZATION_STEPS } from '@/modules/core';
import OnboardingClient from '@/app/(admin)/app/admin/units/[id]/onboarding-client';

export const dynamic = 'force-dynamic';

/**
 * MC mobilization workspace (doc 07 F-OWN-1 via management company).
 */
export default async function McMobilizationUnitPage({
  params,
  searchParams,
}: {
  params: { unitId: string };
  searchParams?: { projectId?: string; organizationId?: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=/mc/mobilization/${params.unitId}`);
  }

  const unit = await prisma.unit.findUnique({
    where: { id: params.unitId },
    include: {
      project: { select: { name: true, id: true } },
      owner: { select: { id: true, firstName: true, lastName: true } },
      engagements: { orderBy: { createdAt: 'desc' } },
      complianceRecords: { orderBy: { createdAt: 'desc' } },
      mobilizationChecklist: true,
    },
  });

  if (!unit) {
    notFound();
  }

  const allowed = await canAccessMcMobilizationUnit(user, {
    projectId: unit.projectId,
    unitId: unit.id,
  });
  if (!allowed) {
    notFound();
  }

  const projectId =
    typeof searchParams?.projectId === 'string' ? searchParams.projectId : unit.projectId;
  const organizationId = typeof searchParams?.organizationId === 'string' ? searchParams.organizationId : '';

  const backQuery = new URLSearchParams();
  if (projectId) backQuery.set('projectId', projectId);
  if (organizationId) backQuery.set('organizationId', organizationId);
  const backHref = backQuery.toString()
    ? `/mc/mobilization?${backQuery.toString()}`
    : '/mc/mobilization';

  const labels = await getLabels({
    'mc.mobilization.back': '← Mobilization queue',
    'admin.onboarding.title': 'Onboarding',
    'admin.onboarding.step': 'Step',
    'admin.onboarding.done': 'Done',
    'admin.onboarding.pending': 'Pending',
    'admin.onboarding.blocked': 'Blocked',
    'admin.onboarding.start_checklist': 'Start the checklist',
    'admin.onboarding.no_checklist': 'This unit has no mobilization checklist yet.',
    'admin.onboarding.complete_step': 'Mark done',
    'admin.onboarding.notes': 'Notes',
    'admin.onboarding.owner_title': 'Owner',
    'admin.onboarding.owner_none': 'No owner set. A mandate cannot be recorded without one.',
    'admin.onboarding.owner_set': 'Set owner',
    'admin.onboarding.owner_email': 'Owner email',
    'admin.onboarding.engagement_title': 'Mandate (engagement)',
    'admin.onboarding.engagement_none':
      'No engagement. Owner statements cannot be generated until one exists.',
    'admin.onboarding.engagement_type': 'Engagement type',
    'admin.onboarding.noi_cap': 'NOI cap per year (THB)',
    'admin.onboarding.noi_cap_hint': 'Required for direct-managed. No default — it must be agreed.',
    'admin.onboarding.record_engagement': 'Record mandate',
    'admin.onboarding.compliance_title': 'Compliance records',
    'admin.onboarding.compliance_none': 'No records yet.',
    'admin.onboarding.record_type': 'Record type',
    'admin.onboarding.label': 'Label',
    'admin.onboarding.expires': 'Expires on',
    'admin.onboarding.add_record': 'Add record',
    'admin.onboarding.confirm_record': 'Confirm',
    'admin.onboarding.permitted_use_warning':
      'Permitted use is confirmed, but no permitted-use record is attached.',
    'admin.onboarding.error_generic': 'Action failed. Please try again.',
    'admin.onboarding.saving': 'Saving…',
  });

  const checklistByStep = Object.fromEntries(
    unit.mobilizationChecklist.map((item) => [item.step, item])
  );

  return (
    <main className="min-h-screen bg-surface-background p-24 md:p-32">
      <div className="max-w-4xl mx-auto">
        <Link href={backHref} className="text-small font-semibold text-brand-andaman hover:underline">
          {labels['mc.mobilization.back']}
        </Link>
        <h1 className="text-heading-1 font-bold text-text-ink mt-12 mb-8">
          {unit.name} · {labels['admin.onboarding.title']}
        </h1>
        <p className="text-body text-text-secondary mb-24">{unit.project.name}</p>

        <OnboardingClient
          unitId={unit.id}
          labels={labels}
          steps={MOBILIZATION_STEPS.map((step) => {
            const item = checklistByStep[step];
            return {
              step,
              itemId: item?.id ?? null,
              status: item?.status ?? null,
              notes: item?.notes ?? null,
              completedAt: item?.completedAt?.toISOString() ?? null,
            };
          })}
          owner={
            unit.owner
              ? { id: unit.owner.id, name: `${unit.owner.firstName} ${unit.owner.lastName}` }
              : null
          }
          engagements={unit.engagements.map((engagement) => ({
            id: engagement.id,
            engagementType: engagement.engagementType,
            status: engagement.status,
            noiCapAnnualThb:
              engagement.noiCapAnnualThb !== null
                ? Math.round(engagement.noiCapAnnualThb / 100)
                : null,
          }))}
          complianceRecords={unit.complianceRecords.map((record) => ({
            id: record.id,
            recordType: record.recordType,
            status: record.status,
            label: record.label,
            expiresOn: record.expiresOn?.toISOString() ?? null,
          }))}
          permittedUseConfirmed={Boolean(unit.permittedUseConfirmedAt)}
        />
      </div>
    </main>
  );
}
