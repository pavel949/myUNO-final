import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { MOBILIZATION_STEPS } from '@/modules/core';
import OnboardingClient from './onboarding-client';

export const dynamic = 'force-dynamic';

/**
 * The onboarding workspace for one unit — doc 07 F-OWN-1, seven steps on one
 * screen.
 *
 * The services behind every step existed and were tested; none had a screen, so
 * mobilization could not be run at all. This is that screen: it shows where a
 * unit is in the sequence and offers exactly the action each step needs.
 */
export default async function UnitOnboardingPage({ params }: { params: { id: string } }) {
  const unit = await prisma.unit.findUnique({
    where: { id: params.id },
    include: {
      project: { select: { name: true } },
      owner: { select: { id: true, firstName: true, lastName: true } },
      engagements: { orderBy: { createdAt: 'desc' } },
      complianceRecords: { orderBy: { createdAt: 'desc' } },
      mobilizationChecklist: true,
    },
  });

  if (!unit) notFound();

  const labels = await getLabels({
    'admin.onboarding.title': 'Onboarding',
    'admin.onboarding.back': 'All units',
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
    <div>
      <Link href="/app/admin/units" className="text-small text-text-secondary hover:underline">
        ← {labels['admin.onboarding.back']}
      </Link>
      <h1 className="text-heading-1 font-bold text-text-ink mt-8 mb-24">
        {unit.name} · {labels['admin.onboarding.title']}
      </h1>

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
        engagements={unit.engagements.map((e) => ({
          id: e.id,
          engagementType: e.engagementType,
          status: e.status,
          // Display boundary: noiCapAnnualThb is satang (THB x 100) in the
          // domain layer — the finance module compares it directly against
          // satang NOI totals (src/modules/finance/statement.service.ts).
          noiCapAnnualThb: e.noiCapAnnualThb !== null ? Math.round(e.noiCapAnnualThb / 100) : null,
        }))}
        complianceRecords={unit.complianceRecords.map((r) => ({
          id: r.id,
          recordType: r.recordType,
          status: r.status,
          label: r.label,
          expiresOn: r.expiresOn?.toISOString() ?? null,
        }))}
        permittedUseConfirmed={Boolean(unit.permittedUseConfirmedAt)}
      />
    </div>
  );
}
