import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { getProjectReadiness } from '@/modules/projects/readiness.service';
import OnboardingStateClient from './onboarding-state-client';

export const dynamic = 'force-dynamic';

const STAGE_DEFINITIONS = [
  {
    id: 'identity',
    labelKey: 'admin.project_onboarding.stage_identity',
    helpKey: 'admin.project_onboarding.stage_identity_help',
    findingAreas: ['identity', 'location'],
    href: (projectId: string) => `/app/admin/projects?edit=${projectId}`,
  },
  {
    id: 'inventory',
    labelKey: 'admin.project_onboarding.stage_inventory',
    helpKey: 'admin.project_onboarding.stage_inventory_help',
    findingAreas: ['inventory'],
    href: (projectId: string) => `/app/admin/units?projectId=${projectId}`,
  },
  {
    id: 'commercial',
    labelKey: 'admin.project_onboarding.stage_commercial',
    helpKey: 'admin.project_onboarding.stage_commercial_help',
    findingAreas: ['pricing'],
    href: (projectId: string) => `/app/admin/config?projectId=${projectId}`,
  },
  {
    id: 'compliance',
    labelKey: 'admin.project_onboarding.stage_compliance',
    helpKey: 'admin.project_onboarding.stage_compliance_help',
    findingAreas: ['compliance'],
    href: (projectId: string) => `/app/admin/compliance?projectId=${projectId}`,
  },
  {
    id: 'operations',
    labelKey: 'admin.project_onboarding.stage_operations',
    helpKey: 'admin.project_onboarding.stage_operations_help',
    findingAreas: ['team', 'services'],
    href: (projectId: string) => `/app/admin/people?projectId=${projectId}`,
  },
  {
    id: 'publish',
    labelKey: 'admin.project_onboarding.stage_publish',
    helpKey: 'admin.project_onboarding.stage_publish_help',
    findingAreas: ['content'],
    href: (projectId: string) => `/app/admin/content?projectId=${projectId}`,
  },
] as const;

export default async function ProjectOnboardingPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, slug: true, status: true },
  });
  if (!project) notFound();

  const [readiness, labels, templates, draft] = await Promise.all([
    getProjectReadiness(prisma, project.id),
    getLabels({
      'admin.project_onboarding.back': 'All projects',
      'admin.project_onboarding.title': 'Property onboarding',
      'admin.project_onboarding.subtitle': 'Complete the six operating stages, clear every blocker, then activate the property.',
      'admin.project_onboarding.readiness': 'Go-live readiness',
      'admin.project_onboarding.ready': 'Ready to activate',
      'admin.project_onboarding.not_ready': 'Not ready yet',
      'admin.project_onboarding.blockers': 'Blockers',
      'admin.project_onboarding.warnings': 'Warnings',
      'admin.project_onboarding.no_blockers': 'No blockers in this stage.',
      'admin.project_onboarding.open_stage': 'Open stage',
      'admin.project_onboarding.setup_title': 'Setup template & progress',
      'admin.project_onboarding.setup_description': 'Template values are inherited defaults only. Operational editors remain the source of truth.',
      'admin.project_onboarding.template_label': 'Template',
      'admin.project_onboarding.no_template': 'No template',
      'admin.project_onboarding.resume_stage': 'Resume at stage',
      'admin.project_onboarding.working_notes': 'Working notes',
      'admin.project_onboarding.working_notes_placeholder': 'What still needs attention?',
      'admin.project_onboarding.autosave_saving': 'Saving…',
      'admin.project_onboarding.autosave_saved': 'Saved',
      'admin.project_onboarding.autosave_failed': 'Autosave failed',
      'admin.project_onboarding.stage_identity': '1. Property identity',
      'admin.project_onboarding.stage_identity_help': 'Location, address and canonical project identity.',
      'admin.project_onboarding.stage_inventory': '2. Units & inventory',
      'admin.project_onboarding.stage_inventory_help': 'Create units and complete the facts required for publication.',
      'admin.project_onboarding.stage_commercial': '3. Pricing & commercial rules',
      'admin.project_onboarding.stage_commercial_help': 'Configure sellable pricing and property rules.',
      'admin.project_onboarding.stage_compliance': '4. Compliance & authority',
      'admin.project_onboarding.stage_compliance_help': 'Verify the operating credentials required for launch.',
      'admin.project_onboarding.stage_operations': '5. Team & services',
      'admin.project_onboarding.stage_operations_help': 'Assign operators and enable the property service network.',
      'admin.project_onboarding.stage_publish': '6. Content & launch',
      'admin.project_onboarding.stage_publish_help': 'Complete imagery/content, review warnings and activate only when ready.',
    }),
    prisma.propertyOnboardingTemplate.findMany({
      where: { active: true },
      orderBy: [{ propertyType: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, propertyType: true, configuration: true },
    }),
    prisma.projectOnboardingDraft.findUnique({
      where: { projectId: project.id },
      select: { templateId: true, lastStage: true, stageData: true, autosavedAt: true },
    }),
  ]);

  const findings = [...readiness.blockers, ...readiness.warnings];

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-24">
      <div>
        <Link href="/app/admin/projects" className="text-small text-brand-andaman font-semibold">
          ← {labels['admin.project_onboarding.back']}
        </Link>
        <div className="mt-12 flex flex-wrap items-end justify-between gap-16">
          <div>
            <p className="text-small text-text-secondary">{project.name} / {project.slug}</p>
            <h1 className="font-display text-display-xl font-semibold text-text-ink">
              {labels['admin.project_onboarding.title']}
            </h1>
            <p className="mt-8 max-w-3xl text-body text-text-secondary">
              {labels['admin.project_onboarding.subtitle']}
            </p>
          </div>
          <div className="min-w-64 rounded-xl border border-border-line bg-surface-paper p-20">
            <p className="text-small text-text-secondary">{labels['admin.project_onboarding.readiness']}</p>
            <div className="mt-4 flex items-baseline gap-8">
              <span className="font-display text-display-lg font-semibold text-text-ink">{readiness.score}%</span>
              <span className="text-small font-semibold text-text-secondary">
                {readiness.ready
                  ? labels['admin.project_onboarding.ready']
                  : labels['admin.project_onboarding.not_ready']}
              </span>
            </div>
          </div>
        </div>
      </div>

      <OnboardingStateClient
        projectId={project.id}
        templates={templates}
        initialDraft={draft}
        labels={labels}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
        {STAGE_DEFINITIONS.map((stage) => {
          const stageFindings = findings.filter((finding) =>
            (stage.findingAreas as readonly string[]).includes(finding.area)
          );
          const blockers = stageFindings.filter((finding) => finding.severity === 'blocker');
          const warnings = stageFindings.filter((finding) => finding.severity === 'warning');
          const complete = blockers.length === 0;

          return (
            <section key={stage.id} className="rounded-xl border border-border-line bg-surface-paper p-20">
              <div className="flex items-start justify-between gap-12">
                <div>
                  <h2 className="text-subtitle font-semibold text-text-ink">{labels[stage.labelKey]}</h2>
                  <p className="mt-4 text-small text-text-secondary">{labels[stage.helpKey]}</p>
                </div>
                <span className={`rounded-full px-10 py-4 text-small font-semibold ${complete ? 'bg-state-success/10 text-state-success' : 'bg-state-warning/10 text-state-warning'}`}>
                  {complete ? '✓' : blockers.length}
                </span>
              </div>

              <div className="mt-16 flex flex-col gap-8">
                {stageFindings.length === 0 ? (
                  <p className="text-small text-text-secondary">{labels['admin.project_onboarding.no_blockers']}</p>
                ) : (
                  <>
                    {blockers.length > 0 ? (
                      <div>
                        <p className="text-small font-semibold text-state-error">{labels['admin.project_onboarding.blockers']}</p>
                        <ul className="mt-4 list-disc pl-20 flex flex-col gap-4">
                          {blockers.map((finding) => (
                            <li key={finding.code} className="text-small text-text-ink">{finding.message}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {warnings.length > 0 ? (
                      <div>
                        <p className="text-small font-semibold text-state-warning">{labels['admin.project_onboarding.warnings']}</p>
                        <ul className="mt-4 list-disc pl-20 flex flex-col gap-4">
                          {warnings.map((finding) => (
                            <li key={finding.code} className="text-small text-text-secondary">{finding.message}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </>
                )}
              </div>

              <Link
                href={stage.href(project.id)}
                className="mt-16 inline-flex text-small font-semibold text-brand-andaman"
              >
                {labels['admin.project_onboarding.open_stage']} →
              </Link>
            </section>
          );
        })}
      </div>
    </div>
  );
}
