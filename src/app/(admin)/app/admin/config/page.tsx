import { getLabels, getRequestLocale } from '@/lib/i18n';
import PricingDesk from './pricing-desk';
import { bangkokCalendarDay, validCalendarDay } from '@/modules/booking/calendar-projection';
import { PRICING_DESK_LABELS, PRICING_DESK_DRAFTS } from '@/modules/content/pricing-desk.seed';
import { COMMERCIAL_LABELS } from '@/components/units/tariff-labels';
import { TARIFF_EDITOR_USABILITY_DRAFTS } from '@/modules/content/tariff-editor-usability.seed';
import { PRICING_WORKSPACE_LABELS, PRICING_WORKSPACE_DRAFTS } from '@/modules/content/pricing-workspace.seed';
import { prisma } from '@/lib/prisma';
import { listProjects } from '@/modules/projects';
import { getConfig } from '@/modules/config';
import ConfigAdminClient from './config-client';

export const dynamic = 'force-dynamic';

/**
 * Canonical pricing desk: seasonal matrix and date-specific calendar edits.
 * The previous project configuration is retained under progressive disclosure
 * for legacy pricing and non-pricing project settings.
 */
const EDITABLE_KEYS = [
  'pricing.season.calendar',
  'pricing.category_rates',
  'pricing.early_bird',
  'catalog.unit_categories',
  'comms.whatsapp_number',
] as const;

export default async function AdminConfigPage(
  props: {
    searchParams: Promise<{ projectId?: string; unitId?: string; view?: string; start?: string }>;
  }
) {
  const searchParams = await props.searchParams;
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

  const units = projectId ? await prisma.unit.findMany({
    where: { projectId, status: { not: 'offboarded' } },
    select: { id: true, name: true, projectId: true, inventoryCategoryId: true, inventoryCategory: { select: { name: true } } },
    orderBy: [{ inventoryCategory: { name: 'asc' } }, { name: 'asc' }],
  }) : [];
  const labels = await getLabels({
    ...PRICING_DESK_LABELS, ...COMMERCIAL_LABELS, ...PRICING_WORKSPACE_LABELS,
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
  }, undefined, { ...PRICING_DESK_DRAFTS, ...TARIFF_EDITOR_USABILITY_DRAFTS, ...PRICING_WORKSPACE_DRAFTS });

  return (
    <div>
      {projectId ? (
        <div className="-m-20 min-h-screen bg-surface-ivory p-20 md:-m-32 md:p-32">
        <PricingDesk key={projectId} projectId={projectId} projects={projects.map(p => ({ id: p.id, name: p.name }))}
          units={units.map(unit => ({ id: unit.id, name: unit.name, projectId: unit.projectId, categoryId: unit.inventoryCategoryId, categoryName: unit.inventoryCategory?.name ?? null }))}
          initialUnitId={searchParams.unitId} initialView={searchParams.view === 'calendar' ? 'calendar' : 'rates'}
          initialStart={searchParams.start && validCalendarDay(searchParams.start) ? searchParams.start : bangkokCalendarDay()}
          today={bangkokCalendarDay()} locale={getRequestLocale()} labels={labels} />
        <details className="mt-32 border-t border-border-line pt-16"><summary className="cursor-pointer text-small text-text-secondary">{labels['pricing.desk.settings']}</summary>
        <div className="mt-16"><ConfigAdminClient
          projectId={projectId}
          projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          values={values}
          overridden={overridden}
          editableKeys={[...EDITABLE_KEYS]}
          labels={labels}
        /></div></details></div>
      ) : (
        <p className="text-body text-text-secondary">{labels['admin.config.no_projects']}</p>
      )}
    </div>
  );
}
