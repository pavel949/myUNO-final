import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { getAgentContext } from '@/modules/distribution';

export const dynamic = 'force-dynamic';

export default async function AgentInventoryPage({
  searchParams,
}: { searchParams?: { q?: string; mode?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/agent/inventory');
  const context = await getAgentContext(prisma, user.identityId);
  if (!context && !user.isAdmin) redirect('/');

  const query = typeof searchParams?.q === 'string' ? searchParams.q.trim() : '';
  const mode = ['stay', 'rent', 'buy'].includes(searchParams?.mode ?? '') ? searchParams?.mode : 'stay';
  const offerTypes = mode === 'buy'
    ? ['sale']
    : mode === 'rent'
      ? ['long_term_rental', 'long_rent']
      : ['short_term_stay', 'short_stay'];

  const units = await prisma.unit.findMany({
    where: {
      status: 'live',
      project: { status: 'live' },
      commercialOfferings: {
        some: {
          status: 'active',
          offeringType: { in: offerTypes },
        },
      },
      ...(query ? {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { project: { name: { contains: query, mode: 'insensitive' } } },
        ],
      } : {}),
    },
    select: {
      id: true,
      name: true,
      bedrooms: true,
      bathrooms: true,
      sizeSqm: true,
      instantBook: true,
      project: { select: { id: true, name: true, city: true, district: true } },
      inventoryCategory: { select: { name: true, baseNightlyThb: true } },
      commercialOfferings: {
        where: { status: 'active', offeringType: { in: offerTypes } },
        select: { id: true, offeringType: true, pricingTerms: true },
      },
    },
    orderBy: [{ project: { name: 'asc' } }, { name: 'asc' }],
    take: 200,
  });

  const labels = await getLabels({
    'agent.inventory.back': '← Agent workspace',
    'agent.inventory.title': 'Inventory',
    'agent.inventory.subtitle': 'One canonical inventory for agent distribution.',
    'agent.inventory.search': 'Search project or home',
    'agent.inventory.stay': 'Stay',
    'agent.inventory.rent': 'Long rent',
    'agent.inventory.buy': 'Buy',
    'agent.inventory.instant': 'Instant',
    'agent.inventory.request': 'Request',
    'agent.inventory.quote': 'Create quote',
    'agent.inventory.add_shortlist': 'Add to shortlist',
    'agent.inventory.empty': 'No distributable inventory matches this search.',
    'agent.common.bedrooms_short': 'BR',
    'agent.common.bathrooms_short': 'BA',
  });

  const href = (nextMode: string) => '/agent/inventory?' + new URLSearchParams({
    mode: nextMode,
    ...(query ? { q: query } : {}),
  }).toString();

  return <main className="min-h-screen bg-surface-ivory p-16 md:p-32">
    <div className="mx-auto max-w-7xl space-y-20">
      <header>
        <Link href="/agent" className="text-small font-semibold text-brand-andaman">{labels['agent.inventory.back']}</Link>
        <h1 className="mt-12 font-display text-display-xl font-semibold text-text-ink">{labels['agent.inventory.title']}</h1>
        <p className="mt-6 text-body text-text-secondary">{labels['agent.inventory.subtitle']}</p>
      </header>

      <form className="flex flex-col gap-8 md:flex-row" action="/agent/inventory">
        <input type="hidden" name="mode" value={mode}/>
        <input name="q" defaultValue={query} placeholder={labels['agent.inventory.search']}
          className="h-44 flex-1 rounded-md border border-border-line bg-white px-12 text-text-ink"/>
        <button className="rounded-md bg-brand-deep px-20 text-small font-semibold text-white">
          {labels['agent.inventory.search']}
        </button>
      </form>

      <nav className="flex gap-8">
        {(['stay','rent','buy'] as const).map(item => <Link key={item} href={href(item)}
          className={'rounded-full px-16 py-8 text-small font-semibold ' + (mode===item?'bg-brand-deep text-white':'border border-border-line bg-surface-paper text-text-ink')}>
          {labels['agent.inventory.'+item]}
        </Link>)}
      </nav>

      {!units.length ? <p className="rounded-lg border border-border-line bg-surface-paper p-20 text-text-secondary">
        {labels['agent.inventory.empty']}
      </p> : <section className="grid gap-12 md:grid-cols-2 xl:grid-cols-3">
        {units.map(unit => <article key={unit.id} className="rounded-xl border border-border-line bg-surface-paper p-18">
          <p className="text-small font-semibold text-brand-andaman">{unit.project.name}</p>
          <h2 className="mt-4 font-display text-heading-3 font-semibold text-text-ink">{unit.name}</h2>
          <p className="mt-6 text-small text-text-secondary">
            {unit.bedrooms} {labels['agent.common.bedrooms_short']} · {unit.bathrooms} {labels['agent.common.bathrooms_short']}{unit.sizeSqm ? ' · '+unit.sizeSqm+' sqm' : ''}
          </p>
          <div className="mt-12 flex items-center justify-between">
            <span className="rounded-full bg-surface-ivory px-10 py-4 text-small font-semibold text-text-secondary">
              {unit.instantBook ? labels['agent.inventory.instant'] : labels['agent.inventory.request']}
            </span>
            {unit.inventoryCategory?.baseNightlyThb ? <span className="font-semibold text-text-ink">
              ฿{Math.round(unit.inventoryCategory.baseNightlyThb/100).toLocaleString()}
            </span> : null}
          </div>
          <div className="mt-16 flex flex-wrap gap-8">
            <Link href={'/agent/quotes/new?unitId='+encodeURIComponent(unit.id)}
              className="rounded-md bg-brand-deep px-12 py-8 text-small font-semibold text-white">
              {labels['agent.inventory.quote']}
            </Link>
            <Link href={'/agent/shortlists/new?unitId='+encodeURIComponent(unit.id)}
              className="rounded-md border border-border-line px-12 py-8 text-small font-semibold text-text-ink">
              {labels['agent.inventory.add_shortlist']}
            </Link>
          </div>
        </article>)}
      </section>}
    </div>
  </main>;
}
