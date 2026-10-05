/* eslint-disable local-rules/no-literal-ui-text */
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import HomepagePlacementClient from './homepage-placement-client';

export const dynamic = 'force-dynamic';

export default async function HomepagePlacementPage() {
  const [placements, projects, units, services, areas] = await Promise.all([
    prisma.homepagePlacement.findMany({
      orderBy: [{ destinationKey: 'asc' }, { sectionKey: 'asc' }, { position: 'asc' }],
    }),
    prisma.project.findMany({
      where: { status: 'live' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 200,
    }),
    prisma.unit.findMany({
      where: { status: 'live', project: { status: 'live' } },
      select: { id: true, name: true, project: { select: { name: true } } },
      orderBy: [{ project: { name: 'asc' } }, { name: 'asc' }],
      take: 500,
    }),
    prisma.service.findMany({
      where: { status: 'active' },
      select: { id: true, title: true },
      orderBy: { title: 'asc' },
      take: 300,
    }),
    prisma.area.findMany({
      where: { status: 'live' },
      select: { id: true, slug: true },
      orderBy: { sort: 'asc' },
      take: 200,
    }),
  ]);

  const candidates = [
    ...projects.map((item) => ({ id: item.id, label: item.name, type: 'project' })),
    ...units.map((item) => ({ id: item.id, label: item.project.name + ' · ' + item.name, type: 'unit' })),
    ...services.map((item) => ({ id: item.id, label: item.title, type: 'service' })),
    ...areas.map((item) => ({ id: item.id, label: item.slug, type: 'area' })),
  ];

  return <main className="mx-auto max-w-7xl p-24 md:p-32">
    <div className="mb-24 flex flex-wrap items-start justify-between gap-16">
      <div>
        <Link href="/app/admin/content" className="text-small font-semibold text-brand-andaman hover:underline">← Content</Link>
        <p className="mt-12 text-kicker uppercase text-brand-andaman">Homepage</p>
        <h1 className="mt-4 font-display text-display-xl font-semibold text-text-ink">Editorial placements</h1>
        <p className="mt-8 max-w-3xl text-body text-text-secondary">
          Curate the visible order by destination and locale. This surface never overrides canonical price, availability, media readiness or operating authority.
        </p>
      </div>
      <Link href="/" className="rounded-lg border border-border-line px-16 py-12 font-semibold text-brand-andaman">Open homepage</Link>
    </div>
    <HomepagePlacementClient
      initialPlacements={placements.map((item) => ({
        ...item,
        visibleFrom: item.visibleFrom?.toISOString() ?? null,
        visibleUntil: item.visibleUntil?.toISOString() ?? null,
      }))}
      candidates={candidates}
    />
  </main>;
}
