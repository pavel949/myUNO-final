import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import {
  loadOpsSwitcherProjects,
  opsBoardScope,
  opsHref,
  resolveOpsProjectContext,
  validatedActiveProjectId,
} from '@/app/libs/opsProjectContext';
import OpsProjectSwitcher from '@/components/ops/OpsProjectSwitcher';
import InventoryCategoryPricingEditor from '@/components/ops/InventoryCategoryPricingEditor';
import { getLabels } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface OpsInventoryPageProps {
  searchParams?: {
    projectId?: string;
  };
}

function formatAdjustment(type: string | null, value: string | null) {
  if (!type || !value) return 'Master / no adjustment';
  if (type === 'percent') return `${Number(value) > 0 ? '+' : ''}${value}%`;
  if (type === 'fixed') return `${Number(value) > 0 ? '+' : ''}฿${Number(value).toLocaleString()}`;
  return `${type} ${value}`;
}

export default async function OpsInventoryPage({ searchParams }: OpsInventoryPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/ops/inventory');
  }

  const opsContext = resolveOpsProjectContext(
    user,
    typeof searchParams?.projectId === 'string' ? searchParams.projectId : null
  );
  const isStaff = opsContext.isAdmin || opsContext.staffProjectIds.length > 0;
  if (!isStaff) {
    redirect('/');
  }

  const projects = await loadOpsSwitcherProjects(prisma, opsContext);
  const validActiveProjectId = validatedActiveProjectId(
    opsContext.activeProjectId,
    projects.map((project) => project.id)
  );
  const scope = opsBoardScope(opsContext, validActiveProjectId);
  const projectIds = scope?.projectIds?.length
    ? scope.projectIds
    : projects.map((project) => project.id);

  const [categories, units, ratePlans] = await Promise.all([
    prisma.inventoryCategory.findMany({
      where: projectIds.length ? { projectId: { in: projectIds } } : { id: '__none__' },
      include: {
        project: { select: { id: true, name: true } },
        _count: { select: { units: true } },
      },
      orderBy: [{ project: { name: 'asc' } }, { name: 'asc' }],
    }),
    prisma.unit.findMany({
      where: {
        status: { not: 'offboarded' },
        ...(projectIds.length ? { projectId: { in: projectIds } } : { id: '__none__' }),
      },
      select: {
        id: true,
        name: true,
        status: true,
        baseNightlyThb: true,
        minNights: true,
        projectId: true,
        project: { select: { id: true, name: true } },
        inventoryCategory: {
          select: {
            id: true,
            name: true,
            categoryKey: true,
            baseNightlyThb: true,
            minNights: true,
          },
        },
        _count: { select: { blockedDates: true, pricingRules: true } },
      },
      orderBy: [{ project: { name: 'asc' } }, { name: 'asc' }],
    }),
    prisma.ratePlan.findMany({
      where: projectIds.length
        ? {
            status: 'active',
            OR: [
              { projectId: { in: projectIds } },
              { category: { projectId: { in: projectIds } } },
              { unit: { projectId: { in: projectIds } } },
            ],
          }
        : { id: '__none__' },
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        projectId: true,
        categoryId: true,
        unitId: true,
        adjustmentType: true,
        adjustmentValue: true,
        minNights: true,
        project: { select: { name: true } },
        category: { select: { name: true, project: { select: { name: true } } } },
        unit: { select: { name: true, project: { select: { name: true } } } },
      },
      orderBy: [{ name: 'asc' }],
    }),
  ]);

  const uncategorized = units.filter((unit) => !unit.inventoryCategory).length;
  const liveUnits = units.filter((unit) => unit.status === 'live').length;

  const labels = await getLabels({
    'staff.inventory.title': 'Inventory & pricing',
    'staff.inventory.subtitle':
      'Canonical setup lives here. The calendar handles operational blocks and dated price exceptions.',
    'staff.inventory.back': '← Today',
    'staff.inventory.calendar': 'Calendar',
    'staff.inventory.admin_units': 'Add / onboard units',
    'staff.inventory.project_setup': 'Project setup',
    'staff.inventory.summary_categories': 'Categories',
    'staff.inventory.summary_units': 'Active units',
    'staff.inventory.summary_uncategorized': 'Uncategorized',
    'staff.inventory.summary_rateplans': 'Active rate plans',
    'staff.inventory.categories_title': 'Sellable inventory categories',
    'staff.inventory.categories_hint':
      'Category base rate and minimum stay are the default commercial truth inherited by linked villas.',
    'staff.inventory.category_units': 'units',
    'staff.inventory.base_rate': 'Base rate / night',
    'staff.inventory.min_nights': 'Minimum stay',
    'staff.inventory.save': 'Save',
    'staff.inventory.saving': 'Saving…',
    'staff.inventory.saved': 'Saved',
    'staff.inventory.error': 'Could not update pricing.',
    'staff.inventory.admin_only': 'Master tariff edits require admin access.',
    'staff.inventory.rateplans_title': 'Rate plans',
    'staff.inventory.rateplans_hint':
      'BAR and derived commercial rules. Dated unit overrides are edited from the calendar.',
    'staff.inventory.rateplans_empty': 'No active rate plans in this scope.',
    'staff.inventory.units_title': 'Physical inventory',
    'staff.inventory.units_hint':
      'Every villa should belong to one canonical category. Open a villa to manage blocks and one-off rates.',
    'staff.inventory.unit': 'Villa / unit',
    'staff.inventory.category': 'Category',
    'staff.inventory.status': 'Status',
    'staff.inventory.overrides': 'Dated overrides',
    'staff.inventory.blocks': 'Blocks',
    'staff.inventory.open_calendar': 'Open calendar',
    'staff.inventory.uncategorized_warning':
      'Uncategorized units do not inherit canonical category pricing. Assign them before treating this inventory as production-ready.',
    'staff.ops.context.switcher': 'Project context',
    'staff.ops.context.all_projects': 'All projects',
    'staff.ops.context.active': 'Showing',
  });

  const cardClass = 'bg-surface-paper border border-border-line rounded-lg p-16';

  return (
    <main className="min-h-screen bg-surface-ivory p-16 md:p-32">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex flex-col gap-16 lg:flex-row lg:items-start lg:justify-between mb-24">
          <div>
            <Link
              href={opsHref('/ops', validActiveProjectId)}
              className="text-small font-semibold text-brand-andaman hover:underline"
            >
              {labels['staff.inventory.back']}
            </Link>
            <h1 className="font-display text-display-xl font-semibold text-text-ink mt-12">
              {labels['staff.inventory.title']}
            </h1>
            <p className="text-body text-text-stone mt-8 max-w-3xl">
              {labels['staff.inventory.subtitle']}
            </p>
          </div>
          <div className="flex flex-wrap gap-8">
            <Link
              href={opsHref('/ops/calendar', validActiveProjectId)}
              className="rounded-md border border-brand-andaman px-12 py-8 text-small font-semibold text-brand-andaman hover:bg-surface-paper"
            >
              {labels['staff.inventory.calendar']}
            </Link>
            {opsContext.isAdmin ? (
              <Link
                href="/app/admin/units"
                className="rounded-md bg-brand-andaman px-12 py-8 text-small font-semibold text-on-dark-text"
              >
                {labels['staff.inventory.admin_units']}
              </Link>
            ) : null}
            {opsContext.isAdmin && validActiveProjectId ? (
              <Link
                href={`/app/admin/projects/${validActiveProjectId}`}
                className="rounded-md border border-border-line bg-surface-paper px-12 py-8 text-small font-semibold text-text-ink"
              >
                {labels['staff.inventory.project_setup']}
              </Link>
            ) : null}
          </div>
        </div>

        <OpsProjectSwitcher
          projects={projects}
          activeProjectId={validActiveProjectId}
          basePath="/ops/inventory"
          labels={labels}
        />

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-12 my-24">
          <div className={cardClass}>
            <p className="text-micro text-text-secondary">{labels['staff.inventory.summary_categories']}</p>
            <p className="font-display text-display font-semibold text-text-ink mt-4">{categories.length}</p>
          </div>
          <div className={cardClass}>
            <p className="text-micro text-text-secondary">{labels['staff.inventory.summary_units']}</p>
            <p className="font-display text-display font-semibold text-text-ink mt-4">{liveUnits}</p>
          </div>
          <div className={cardClass}>
            <p className="text-micro text-text-secondary">{labels['staff.inventory.summary_uncategorized']}</p>
            <p className="font-display text-display font-semibold text-text-ink mt-4">{uncategorized}</p>
          </div>
          <div className={cardClass}>
            <p className="text-micro text-text-secondary">{labels['staff.inventory.summary_rateplans']}</p>
            <p className="font-display text-display font-semibold text-text-ink mt-4">{ratePlans.length}</p>
          </div>
        </section>

        {uncategorized > 0 ? (
          <div className="mb-24 rounded-lg border border-state-warning bg-state-warning-soft p-16 text-small text-text-ink">
            {labels['staff.inventory.uncategorized_warning']}
          </div>
        ) : null}

        <section className={`${cardClass} mb-24`}>
          <div className="mb-16">
            <h2 className="font-display text-title font-semibold text-text-ink">
              {labels['staff.inventory.categories_title']}
            </h2>
            <p className="text-small text-text-secondary mt-4">
              {labels['staff.inventory.categories_hint']}
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
            {categories.map((category) => (
              <article
                key={category.id}
                className="rounded-lg border border-border-line bg-surface-ivory p-16"
              >
                <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-micro text-text-secondary">{category.project.name}</p>
                    <h3 className="text-body font-semibold text-text-ink mt-2">{category.name}</h3>
                    <p className="text-micro text-text-muted mt-2">{category.categoryKey}</p>
                    <p className="text-small text-text-secondary mt-8">
                      {category.bedrooms}BR · {category.bathrooms}BA · sleeps {category.maxGuests} ·{' '}
                      {category._count.units} {labels['staff.inventory.category_units']}
                    </p>
                  </div>
                  <span className="rounded-full border border-border-line bg-surface-paper px-8 py-3 text-micro text-text-secondary">
                    {category.status}
                  </span>
                </div>
                <div className="mt-16 border-t border-border-line pt-12">
                  <InventoryCategoryPricingEditor
                    categoryId={category.id}
                    baseNightlyBaht={Math.round(category.baseNightlyThb / 100)}
                    minNights={category.minNights}
                    canEdit={opsContext.isAdmin}
                    labels={{
                      baseRate: labels['staff.inventory.base_rate'],
                      minNights: labels['staff.inventory.min_nights'],
                      save: labels['staff.inventory.save'],
                      saving: labels['staff.inventory.saving'],
                      saved: labels['staff.inventory.saved'],
                      error: labels['staff.inventory.error'],
                      adminOnly: labels['staff.inventory.admin_only'],
                    }}
                  />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={`${cardClass} mb-24`}>
          <div className="mb-16">
            <h2 className="font-display text-title font-semibold text-text-ink">
              {labels['staff.inventory.rateplans_title']}
            </h2>
            <p className="text-small text-text-secondary mt-4">
              {labels['staff.inventory.rateplans_hint']}
            </p>
          </div>
          {ratePlans.length === 0 ? (
            <p className="text-small text-text-muted">{labels['staff.inventory.rateplans_empty']}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {ratePlans.map((plan) => {
                const scopeName = plan.unit
                  ? `${plan.unit.project.name} · ${plan.unit.name}`
                  : plan.category
                    ? `${plan.category.project.name} · ${plan.category.name}`
                    : plan.project?.name || 'Project';
                return (
                  <div key={plan.id} className="rounded-md border border-border-line bg-surface-ivory p-12">
                    <div className="flex justify-between gap-8">
                      <div>
                        <p className="text-body font-semibold text-text-ink">{plan.name}</p>
                        <p className="text-micro text-text-secondary">{plan.code} · {scopeName}</p>
                      </div>
                      <span className="text-micro text-text-secondary">{plan.status}</span>
                    </div>
                    <p className="text-small text-text-ink mt-8">
                      {formatAdjustment(
                        plan.adjustmentType,
                        plan.adjustmentValue ? plan.adjustmentValue.toString() : null
                      )}
                      {plan.minNights ? ` · min ${plan.minNights} nights` : ''}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className={cardClass}>
          <div className="mb-16">
            <h2 className="font-display text-title font-semibold text-text-ink">
              {labels['staff.inventory.units_title']}
            </h2>
            <p className="text-small text-text-secondary mt-4">
              {labels['staff.inventory.units_hint']}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-small">
              <thead>
                <tr className="border-b border-border-line text-left text-text-secondary">
                  <th className="py-8 pr-12">{labels['staff.inventory.unit']}</th>
                  <th className="py-8 pr-12">{labels['staff.inventory.category']}</th>
                  <th className="py-8 pr-12">{labels['staff.inventory.base_rate']}</th>
                  <th className="py-8 pr-12">{labels['staff.inventory.min_nights']}</th>
                  <th className="py-8 pr-12">{labels['staff.inventory.status']}</th>
                  <th className="py-8 pr-12">{labels['staff.inventory.blocks']}</th>
                  <th className="py-8 pr-12">{labels['staff.inventory.overrides']}</th>
                  <th className="py-8" />
                </tr>
              </thead>
              <tbody>
                {units.map((unit) => {
                  const baseRate = unit.inventoryCategory?.baseNightlyThb ?? unit.baseNightlyThb;
                  const minStay = unit.inventoryCategory?.minNights ?? unit.minNights;
                  return (
                    <tr key={unit.id} className="border-b border-border-line last:border-0">
                      <td className="py-10 pr-12">
                        <p className="font-medium text-text-ink">{unit.name}</p>
                        <p className="text-micro text-text-secondary">{unit.project.name}</p>
                      </td>
                      <td className="py-10 pr-12">
                        {unit.inventoryCategory ? (
                          <><p className="text-text-ink">{unit.inventoryCategory.name}</p><p className="text-micro text-text-secondary">{unit.inventoryCategory.categoryKey}</p></>
                        ) : (
                          <span className="text-state-warning">Uncategorized</span>
                        )}
                      </td>
                      <td className="py-10 pr-12 tabular-nums">฿{Math.round(baseRate / 100).toLocaleString()}</td>
                      <td className="py-10 pr-12">{minStay}</td>
                      <td className="py-10 pr-12">{unit.status}</td>
                      <td className="py-10 pr-12">{unit._count.blockedDates}</td>
                      <td className="py-10 pr-12">{unit._count.pricingRules}</td>
                      <td className="py-10 text-right">
                        <Link
                          href={opsHref(`/ops/calendar/${unit.id}`, validActiveProjectId ?? unit.projectId)}
                          className="font-semibold text-brand-andaman hover:underline"
                        >
                          {labels['staff.inventory.open_calendar']} →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
