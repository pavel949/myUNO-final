/* eslint-disable local-rules/no-literal-ui-text */
import { UI_LOCALE } from '@/lib/format';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import ProjectWorkspaceNav from '@/components/projects/ProjectWorkspaceNav';

export const dynamic = 'force-dynamic';

export default async function ProjectInventoryPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=' + encodeURIComponent('/app/admin/projects/' + params.id + '/inventory'));
  if (!user.isAdmin) redirect('/');

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: {
      id: true, name: true,
      inventoryCategories: {
        orderBy: [{ name: 'asc' }],
        select: {
          id: true, name: true, categoryKey: true, status: true,
          bedrooms: true, bathrooms: true, maxGuests: true, baseNightlyThb: true, minNights: true,
          units: {
            orderBy: { name: 'asc' },
            select: {
              id: true, name: true, status: true, assetStatus: true,
              bedrooms: true, bathrooms: true, maxGuests: true, sizeSqm: true,
              _count: { select: { media: true, bookings: true } },
            },
          },
        },
      },
    },
  });
  if (!project) notFound();

  const unitCount = project.inventoryCategories.reduce((n,c) => n + c.units.length, 0);

  return <main className="mx-auto max-w-7xl p-24 md:p-32">
    <ProjectWorkspaceNav projectId={project.id} active="inventory" />
    <div className="mb-24 flex flex-wrap items-end justify-between gap-12">
      <div>
        <p className="text-kicker uppercase text-brand-andaman">Inventory</p>
        <h1 className="mt-4 font-display text-display-xl font-semibold text-text-ink">{project.name}</h1>
        <p className="mt-8 text-body text-text-secondary">{project.inventoryCategories.length} categories · {unitCount} exact physical units</p>
      </div>
      <Link href={`/app/admin/properties/${project.id}/onboarding`} className="rounded-md bg-brand-andaman px-16 py-12 font-semibold text-white">Add / edit inventory</Link>
    </div>

    <div className="space-y-16">
      {project.inventoryCategories.map(category => <section key={category.id} className="rounded-md border border-border-line bg-surface-paper">
        <div className="flex flex-wrap items-start justify-between gap-12 border-b border-border-line p-16">
          <div>
            <h2 className="font-display text-heading-2 font-semibold">{category.name}</h2>
            <p className="mt-4 text-small text-text-secondary">{category.categoryKey} · {category.bedrooms} bd / {category.bathrooms} ba · up to {category.maxGuests} guests · {category.status}</p>
          </div>
          <div className="text-right text-small">
            <p className="font-semibold">฿{Math.round(category.baseNightlyThb/100).toLocaleString(UI_LOCALE)} base</p>
            <p className="text-text-secondary">{category.minNights} night minimum · {category.units.length} units</p>
          </div>
        </div>
        <div className="divide-y divide-border-line">
          {category.units.map(unit => <Link key={unit.id} href={`/app/admin/units/${unit.id}`} className="grid gap-8 p-16 hover:bg-surface-ivory md:grid-cols-[1fr_160px_150px_160px] md:items-center">
            <div><p className="font-semibold text-text-ink">{unit.name}</p><p className="text-small text-text-secondary">{category.name} · {unit.bedrooms} bd / {unit.bathrooms} ba{unit.sizeSqm ? ` · ${unit.sizeSqm} sqm` : ''}</p></div>
            <p className="text-small text-text-secondary">{unit.status} · {unit.assetStatus}</p>
            <p className="text-small text-text-secondary">{unit._count.media} photos</p>
            <p className="text-small text-text-secondary">{unit._count.bookings} bookings</p>
          </Link>)}
          {!category.units.length ? <p className="p-16 text-small text-text-secondary">No exact units assigned to this category.</p> : null}
        </div>
      </section>)}
      {!project.inventoryCategories.length ? <div className="rounded-md border border-dashed border-border-line p-32 text-center text-text-secondary">No canonical inventory categories yet.</div> : null}
    </div>
  </main>;
}
