import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import {
  loadOpsSwitcherProjects,
  opsBoardScope,
  opsHref,
  resolveOpsProjectContext,
  validatedActiveProjectId,
} from '@/app/libs/opsProjectContext';
import OpsProjectSwitcher from '@/components/ops/OpsProjectSwitcher';

export const dynamic = 'force-dynamic';
/* eslint-disable local-rules/no-literal-ui-text -- authenticated operations surface; labels are not public content */

interface OpsCalendarIndexPageProps {
  searchParams?: { projectId?: string; categoryId?: string };
}

/**
 * Canonical Stay calendar entry surface.
 *
 * This page never owns availability. It is a scoped projection over the same
 * Project -> InventoryCategory -> Unit inventory used by booking/search.
 * Booking/BlockedDate/hold truth remains in the canonical availability engine.
 */
export default async function OpsCalendarIndexPage({ searchParams }: OpsCalendarIndexPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/ops/calendar');

  const opsContext = resolveOpsProjectContext(
    user,
    typeof searchParams?.projectId === 'string' ? searchParams.projectId : null
  );
  const isStaff = opsContext.isAdmin || opsContext.staffProjectIds.length > 0;
  if (!isStaff) redirect('/');

  const projects = await loadOpsSwitcherProjects(prisma, opsContext);
  const validActiveProjectId = validatedActiveProjectId(
    opsContext.activeProjectId,
    projects.map((project) => project.id)
  );
  const scope = opsBoardScope(opsContext, validActiveProjectId);

  const units = await prisma.unit.findMany({
    where: {
      status: { not: 'offboarded' },
      ...(scope?.projectIds?.length ? { projectId: { in: scope.projectIds } } : {}),
    },
    select: {
      id: true,
      name: true,
      projectId: true,
      inventoryCategoryId: true,
      project: { select: { id: true, name: true } },
      inventoryCategory: { select: { id: true, name: true } },
    },
    orderBy: [{ project: { name: 'asc' } }, { inventoryCategory: { name: 'asc' } }, { name: 'asc' }],
  });

  const selectedCategoryId =
    typeof searchParams?.categoryId === 'string' ? searchParams.categoryId : null;
  const categories = Array.from(
    new Map(
      units
        .filter((unit) => unit.inventoryCategory)
        .map((unit) => [
          unit.inventoryCategory!.id,
          { id: unit.inventoryCategory!.id, name: unit.inventoryCategory!.name },
        ])
    ).values()
  );
  const visibleUnits = selectedCategoryId
    ? units.filter((unit) => unit.inventoryCategoryId === selectedCategoryId)
    : units;

  const labels = await getLabels({
    'staff.ops.calendar_index.title': 'Stay calendar',
    'staff.ops.calendar_index.back': '← Ops board',
    'staff.ops.calendar_index.hint':
      'One inventory calendar. Switch from the full property to a category or a single home without changing the source of truth.',
    'staff.ops.calendar_index.empty': 'No units in this scope.',
    'staff.ops.calendar_index.open': 'Open unit →',
    'staff.ops.calendar_index.full': 'Full property',
    'staff.ops.calendar_index.categories': 'Categories',
    'staff.ops.calendar_index.units': 'Homes',
    'staff.ops.calendar_index.uncategorized': 'Uncategorized',
    'staff.ops.context.switcher': 'Project context',
    'staff.ops.context.all_projects': 'All projects',
    'staff.ops.context.active': 'Showing',
  });

  const categoryHref = (categoryId?: string) => {
    const query = new URLSearchParams();
    if (validActiveProjectId) query.set('projectId', validActiveProjectId);
    if (categoryId) query.set('categoryId', categoryId);
    const suffix = query.toString();
    return suffix ? `/ops/calendar?${suffix}` : '/ops/calendar';
  };

  return (
    <main className="min-h-screen bg-surface-ivory p-24 md:p-32">
      <div className="max-w-6xl mx-auto">
        <Link href={opsHref('/ops', validActiveProjectId)} className="text-small font-semibold text-brand-andaman hover:underline">
          {labels['staff.ops.calendar_index.back']}
        </Link>
        <div className="mt-12 mb-24">
          <p className="text-kicker uppercase text-brand-andaman font-semibold">Stay availability</p>
          <h1 className="font-display text-display-xl font-semibold text-text-ink mt-4">
            {labels['staff.ops.calendar_index.title']}
          </h1>
          <p className="text-body text-text-stone mt-8 max-w-3xl">
            {labels['staff.ops.calendar_index.hint']}
          </p>
        </div>

        <OpsProjectSwitcher projects={projects} activeProjectId={validActiveProjectId} basePath="/ops/calendar" labels={labels} />

        <nav className="mt-24 flex flex-wrap gap-8" aria-label="Calendar scope">
          <Link href={categoryHref()} className={`px-16 py-8 rounded-full border text-small font-semibold ${!selectedCategoryId ? 'bg-brand-deep text-on-dark-text border-brand-deep' : 'bg-surface-paper text-text-ink border-border-line'}`}>
            {labels['staff.ops.calendar_index.full']}
          </Link>
          {categories.map((category) => (
            <Link key={category.id} href={categoryHref(category.id)} className={`px-16 py-8 rounded-full border text-small font-semibold ${selectedCategoryId === category.id ? 'bg-brand-deep text-on-dark-text border-brand-deep' : 'bg-surface-paper text-text-ink border-border-line'}`}>
              {category.name}
            </Link>
          ))}
        </nav>

        <div className="mt-24 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-20">
          <aside className="bg-surface-paper border border-border-line rounded-lg p-20 h-fit">
            <p className="text-small uppercase tracking-wide text-text-secondary mb-12">
              {labels['staff.ops.calendar_index.categories']}
            </p>
            <div className="space-y-8">
              {categories.map((category) => {
                const count = units.filter((unit) => unit.inventoryCategoryId === category.id).length;
                return <Link key={category.id} href={categoryHref(category.id)} className="flex justify-between gap-12 text-small text-text-ink hover:text-brand-andaman"><span>{category.name}</span><span>{count}</span></Link>;
              })}
            </div>
          </aside>

          <section>
            <div className="flex items-center justify-between mb-12">
              <h2 className="font-display text-heading-3 text-text-ink">
                {labels['staff.ops.calendar_index.units']}
              </h2>
              <span className="text-small text-text-secondary">{visibleUnits.length}</span>
            </div>
            {visibleUnits.length === 0 ? (
              <p className="text-body text-text-secondary">{labels['staff.ops.calendar_index.empty']}</p>
            ) : (
              <div className="overflow-hidden bg-surface-paper border border-border-line rounded-lg">
                {visibleUnits.map((unit) => (
                  <Link
                    key={unit.id}
                    href={opsHref(`/ops/calendar/${unit.id}`, validActiveProjectId ?? unit.project.id)}
                    className="grid grid-cols-[1fr_auto] md:grid-cols-[1.2fr_1fr_auto] items-center gap-16 p-16 border-b border-border-line last:border-0 hover:bg-surface-ivory transition-colors"
                  >
                    <div>
                      <p className="text-body font-semibold text-text-ink">{unit.name}</p>
                      <p className="text-small text-text-secondary mt-2">{unit.project.name}</p>
                    </div>
                    <p className="hidden md:block text-small text-text-secondary">
                      {unit.inventoryCategory?.name ?? labels['staff.ops.calendar_index.uncategorized']}
                    </p>
                    <span className="text-small font-semibold text-brand-andaman">{labels['staff.ops.calendar_index.open']}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
