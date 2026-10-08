import Link from 'next/link';
import { pmsWorkspaceSelectionHref } from '@/lib/pms-navigation';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { listOperatingSpacesForIdentity } from '@/modules/ops';

export const dynamic = 'force-dynamic';

export default async function OperatingSpacesPage({ searchParams }: { searchParams?: { view?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/ops/spaces');

  const spaces = user.isAdmin
    ? await prisma.operatingSpace.findMany({
        where: { status: 'active' },
        select: {
          id: true,
          key: true,
          name: true,
          timezone: true,
          organizationId: true,
          _count: {
            select: {
              units: { where: { active: true } },
              members: { where: { active: true } },
            },
          },
        },
        orderBy: { name: 'asc' },
      })
    : await listOperatingSpacesForIdentity(prisma, user.identityId);

  if (!user.isAdmin && !spaces.length) redirect('/ops');
  // The shell sends a staff member here when their current URL has no
  // operating-space context. A single permitted space needs no extra chooser;
  // destination pages still enforce membership and unit scope themselves.
  if (spaces.length === 1 &&
      (searchParams?.view === 'housekeeping' || searchParams?.view === 'maintenance')) {
    redirect(pmsWorkspaceSelectionHref(searchParams.view, spaces[0].id));
  }

  const labels = await getLabels({
    'staff.spaces.back': '← Operations',
    'staff.spaces.kicker': 'MANAGED PORTFOLIO',
    'staff.spaces.title': 'Operating spaces',
    'staff.spaces.subtitle': 'Choose the management context for calendar, reservations, tasks, pricing and reporting.',
    'staff.spaces.units': 'managed homes',
    'staff.spaces.team': 'team members',
    'staff.spaces.open': 'Open workspace →',
    'staff.spaces.empty': 'No operating spaces are assigned to this account.',
  });

  return <main className="stitch-workspace p-16 md:p-32">
    <div className="mx-auto max-w-6xl space-y-24">
      <header>
        <Link href="/ops" className="text-small font-semibold text-brand-andaman hover:underline">
          {labels['staff.spaces.back']}
        </Link>
        <p className="mt-16 stitch-kicker">
          {labels['staff.spaces.kicker']}
        </p>
        <h1 className="mt-8 font-display text-display-xl font-semibold text-text-ink">
          {labels['staff.spaces.title']}
        </h1>
        <p className="mt-8 max-w-2xl text-body text-text-secondary">
          {labels['staff.spaces.subtitle']}
        </p>
      </header>

      {!spaces.length ? (
        <div className="rounded-lg border border-border-line bg-surface-paper p-20 text-body text-text-secondary">
          {labels['staff.spaces.empty']}
        </div>
      ) : (
        <section className="grid gap-16 md:grid-cols-2 xl:grid-cols-3">
          {spaces.map((space) => (
            <article key={space.id} className="stitch-panel p-20">
              <p className="text-small font-semibold text-brand-andaman">{space.key}</p>
              <h2 className="mt-8 font-display text-heading-2 font-semibold text-text-ink">{space.name}</h2>
              <div className="mt-16 grid grid-cols-2 gap-8">
                <div className="rounded-md bg-surface-ivory p-12">
                  <p className="font-display text-heading-3 font-bold text-text-ink">{space._count.units}</p>
                  <p className="text-small text-text-secondary">{labels['staff.spaces.units']}</p>
                </div>
                <div className="rounded-md bg-surface-ivory p-12">
                  <p className="font-display text-heading-3 font-bold text-text-ink">{space._count.members}</p>
                  <p className="text-small text-text-secondary">{labels['staff.spaces.team']}</p>
                </div>
              </div>
              <Link href={pmsWorkspaceSelectionHref(searchParams?.view || '', space.id)}
                className="mt-20 inline-flex rounded-lg bg-brand-deep px-16 py-8 text-small font-semibold text-white transition hover:bg-brand-andaman">
                {labels['staff.spaces.open']}
              </Link>
            </article>
          ))}
        </section>
      )}
    </div>
  </main>;
}
