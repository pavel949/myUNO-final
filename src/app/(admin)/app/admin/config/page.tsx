import { getLabels } from '@/lib/i18n';
import { PageHeading } from '@/components/premium/StitchPage';
import { prisma } from '@/lib/prisma';
import { listProjects } from '@/modules/projects';
import { getConfig } from '@/modules/config';
import ConfigAdminClient from './config-client';

export const dynamic = 'force-dynamic';

/**
 * Minimal project-scope config editor (LY-9): the founder's "CRUD
 * categories / tariffs / seasons" — data, not code. Server-side validators
 * in config/edit.service.ts reject malformed shapes and raw-THB pastes.
 */
const EDITABLE_KEYS = [
  'pricing.season.calendar',
  'pricing.category_rates',
  'pricing.early_bird',
  'catalog.unit_categories',
  'comms.whatsapp_number',
] as const;

export default async function AdminConfigPage({
  searchParams,
}: {
  searchParams: { projectId?: string };
}) {
  const projects = await listProjects();
  const projectId =
    searchParams.projectId && projects.some((p) => p.id === searchParams.projectId)
      ? searchParams.projectId
      : projects[0]?.id;

  const values: Record<string, unknown> = {};
  const overridden: Record<string, boolean> = {};
  if (projectId) {
    for (const key of EDITABLE_KEYS) {
      values[key] = (await getConfig(prisma, key, { projectId })) ?? null;
      const override = await prisma.configOverride.findUnique({
        where: {
          parameterKey_scopeType_scopeId: {
            parameterKey: key,
            scopeType: 'project',
            scopeId: projectId,
          },
        },
        select: { id: true },
      });
      overridden[key] = override !== null;
    }
  }

  const labels = await getLabels({
    'admin.config.title': 'Pricing & configuration',
    'admin.config.subtitle':
      'Per-project business rules: seasons, category tariffs, early-bird, concierge WhatsApp. Amounts are satang (THB × 100).',
    'admin.config.project': 'Project',
    'admin.config.overridden': 'project override',
    'admin.config.inherited': 'global default',
    'admin.config.save': 'Save',
    'admin.config.saved': 'Saved.',
    'admin.config.error_json': 'Invalid JSON — fix the syntax and try again.',
    'admin.config.error_generic': 'Save failed. Please try again.',
    'admin.config.no_projects': 'Create a project first.',
    'admin.config.history_show': 'View history',
    'admin.config.history_hide': 'Hide history',
    'admin.config.history_loading': 'Loading change history…',
    'admin.config.history_empty': 'No changes recorded for this parameter yet.',
    'admin.config.history_error': 'Could not load change history.',
  });

  return (
    <div>
      <PageHeading title={labels['admin.config.title']} subtitle={labels['admin.config.subtitle']} />
      {projectId ? (
        <ConfigAdminClient
          projectId={projectId}
          projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          values={values}
          overridden={overridden}
          editableKeys={[...EDITABLE_KEYS]}
          labels={labels}
        />
      ) : (
        <p className="text-body text-text-secondary">{labels['admin.config.no_projects']}</p>
      )}
    </div>
  );
}
