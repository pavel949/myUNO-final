import Link from 'next/link';
import Image from 'next/image';
import { prisma } from '@/lib/prisma';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { listPublicCommercialHomes, type HomeIntent } from '@/modules/projects/commercial-discovery';
import { LeadFormSection } from '@/app/(public)/lead-form-section';
import { getDestination } from '@/modules/destinations';
import { track } from '@/modules/analytics';

export const dynamic = 'force-dynamic';

type SearchParams = {
  projectId?: string;
  intent?: string;
  area?: string;
  type?: string;
  bedrooms?: string;
  minArea?: string;
  maxArea?: string;
  minPrice?: string;
  maxPrice?: string;
  moveIn?: string;
  leaseTermMonths?: string;
  pets?: string;
};

const positiveNumber = (value?: string) => {
  const parsed = value ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

export default async function HomesPage({ searchParams }: { searchParams?: SearchParams }) {
  const intent: HomeIntent = searchParams?.intent === 'rent' ? 'rent' : 'buy';
  const destination = getDestination();
  const [allHomes, labels] = await Promise.all([
    listPublicCommercialHomes(
      prisma,
      intent,
      undefined,
      searchParams?.projectId,
      {
        moveIn: searchParams?.moveIn,
        leaseTermMonths: positiveNumber(searchParams?.leaseTermMonths),
        pets: searchParams?.pets === 'yes' || searchParams?.pets === 'no' ? searchParams.pets : 'any',
      }
    ).catch(() => []),
    getLabels({
      'homes.kicker': 'myUNO · REAL ESTATE',
      'homes.inquiry.buy': `I am looking to purchase a property in ${destination.name}.`,
      'homes.inquiry.rent': `I am looking for a long-term rental in ${destination.name}.`,
      'homes.title': `Homes in ${destination.name}`,
      'homes.subtitle': 'Explore real properties with documented listing authority. Every transaction is reviewed individually.',
      'homes.buy': 'Buy',
      'homes.rent': 'Long-term rent',
      'homes.filters': 'Filter homes',
      'homes.area_filter': 'Area',
      'homes.all_areas': 'All areas',
      'homes.type_filter': 'Property type',
      'homes.all_types': 'All types',
      'homes.type.condo': 'Condo',
      'homes.type.villa': 'Villa',
      'homes.type.townhouse': 'Townhouse',
      'homes.bedrooms_filter': 'Minimum bedrooms',
      'homes.min_area': 'Minimum area',
      'homes.max_area': 'Maximum area',
      'homes.min_price': 'Minimum price',
      'homes.max_price': 'Maximum price',
      'homes.apply_filters': 'Apply filters',
      'homes.clear_filters': 'Clear',
      'homes.price_note': 'Price filtering only uses structured values published on the active commercial offering. Homes without a supported public price are excluded when a price filter is applied.',
      'homes.empty': 'No verified properties match these filters. Submit an enquiry for a tailored search.',
      'homes.bedrooms': 'bedrooms',
      'homes.bathrooms': 'bathrooms',
      'homes.area': 'sqm',
      'homes.details': 'Explore property',
      'homes.price': 'Commercial terms on request',
      'homes.sale_price': 'Asking price',
      'homes.monthly_price': 'Monthly rent',
      'homes.contact': 'Tell us what you are looking for',
      'homes.move_in': 'Move-in',
      'homes.lease_term': 'Lease term, months',
      'homes.pets': 'Pets',
      'homes.pets_any': 'Any',
      'homes.pets_yes': 'Pet-friendly only',
      'homes.pets_no': 'No pets needed',
      'homes.minimum_term': 'Minimum term',
      'homes.deposit': 'Deposit',
      'homes.available_from': 'Available from',
      'homes.responsibility_unit': 'This home is managed by {org}',
      'homes.detail.months_unit': '{count} months',
    }),
  ]);

  const area = (searchParams?.area || '').trim();
  const type = (searchParams?.type || '').trim();
  const bedrooms = positiveNumber(searchParams?.bedrooms);
  const minArea = positiveNumber(searchParams?.minArea);
  const maxArea = positiveNumber(searchParams?.maxArea);
  const minPrice = positiveNumber(searchParams?.minPrice);
  const maxPrice = positiveNumber(searchParams?.maxPrice);
  const leaseTermMonths = positiveNumber(searchParams?.leaseTermMonths);

  const homes = allHomes.filter((home) => {
    const price = home.priceThb[intent] ?? null;
    if (searchParams?.projectId && home.project.id !== searchParams.projectId) return false;
    if (area && home.project.areaSlug !== area) return false;
    if (type && home.unitType !== type) return false;
    if (bedrooms !== null && home.bedrooms < bedrooms) return false;
    if (minArea !== null && (home.sizeSqm === null || home.sizeSqm < minArea)) return false;
    if (maxArea !== null && (home.sizeSqm === null || home.sizeSqm > maxArea)) return false;
    if (minPrice !== null && (price === null || price < minPrice)) return false;
    if (maxPrice !== null && (price === null || price > maxPrice)) return false;
    return true;
  });

  await track(prisma, homes.length > 0 ? 'search_completed' : 'search_zero_results', {
    destination: destination.key,
    locale: getRequestLocale(),
    intent: intent === 'rent' ? 'monthly' : 'buy',
    source: 'commercial_search',
    projectId: searchParams?.projectId,
    resultsCount: homes.length,
    hasMoveIn: Boolean(searchParams?.moveIn),
    hasLeaseTerm: Boolean(leaseTermMonths),
  }).catch(() => null);

  const areas = [...new Set(allHomes.map((home) => home.project.areaSlug).filter((value): value is string => Boolean(value)))].sort();
  const modeLink = (value: HomeIntent) => {
    const params = new URLSearchParams({ intent: value });
    if (searchParams?.projectId) params.set('projectId', searchParams.projectId);
    return '/homes?' + params.toString();
  };

  const detailHref = (id: string) => {
    const params = new URLSearchParams({ intent });
    for (const key of ['area', 'type', 'bedrooms', 'minArea', 'maxArea', 'minPrice', 'maxPrice', 'moveIn', 'leaseTermMonths', 'pets'] as const) {
      const value = searchParams?.[key];
      if (value) params.set(key, value);
    }
    if (searchParams?.projectId) params.set('projectId', searchParams.projectId);
    return '/homes/' + encodeURIComponent(id) + '?' + params.toString();
  };

  return <main className="min-h-screen bg-surface-ivory">
    <section className="bg-brand-deep px-20 py-48 text-surface-ivory md:px-32 md:py-64">
      <div className="mx-auto max-w-6xl">
        <p className="text-kicker uppercase tracking-widest text-brand-sun-soft">{labels['homes.kicker']}</p>
        <h1 className="mt-12 font-display text-display-xl font-semibold">{labels['homes.title']}</h1>
        <p className="mt-12 max-w-2xl text-body text-surface-ivory/90">{labels['homes.subtitle']}</p>
      </div>
    </section>

    <div className="mx-auto max-w-6xl px-20 py-40 md:px-32">
      <nav aria-label={labels['homes.title']} className="mb-24 flex flex-wrap gap-8">
        {(['buy','rent'] as const).map(mode =>
          <Link key={mode} href={modeLink(mode)} aria-current={intent===mode?'page':undefined}
            className={'rounded-full border px-24 py-12 text-small font-semibold '+
              (intent===mode?'border-brand-deep bg-brand-deep text-white':'border-border-line bg-surface-paper text-text-ink')}>
            {mode==='buy'?labels['homes.buy']:labels['homes.rent']}
          </Link>)}
      </nav>

      <form method="get" className="mb-32 rounded-2xl border border-border-line bg-surface-paper p-16 shadow-card md:p-20">
        <input type="hidden" name="intent" value={intent} />
        {searchParams?.projectId && <input type="hidden" name="projectId" value={searchParams.projectId} />}
        <div className="flex items-center justify-between gap-16">
          <h2 className="font-display text-title font-semibold text-text-ink">{labels['homes.filters']}</h2>
          <Link href={modeLink(intent)} className="text-small font-semibold text-brand-andaman hover:underline">
            {labels['homes.clear_filters']}
          </Link>
        </div>
        <div className="mt-16 grid gap-12 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-small text-text-secondary">
            {labels['homes.area_filter']}
            <select name="area" defaultValue={area} className="mt-8 h-48 w-full rounded-lg border border-border-line bg-white px-12 text-text-ink">
              <option value="">{labels['homes.all_areas']}</option>
              {areas.map((slug) => <option key={slug} value={slug}>{slug}</option>)}
            </select>
          </label>
          {intent === 'rent' ? <>
            <label className="text-small text-text-secondary">
              {labels['homes.move_in']}
              <input name="moveIn" type="month" defaultValue={searchParams?.moveIn || ''} className="mt-8 h-48 w-full rounded-lg border border-border-line bg-white px-12 text-text-ink" />
            </label>
            <label className="text-small text-text-secondary">
              {labels['homes.lease_term']}
              <input name="leaseTermMonths" type="number" min="1" defaultValue={searchParams?.leaseTermMonths || ''} className="mt-8 h-48 w-full rounded-lg border border-border-line bg-white px-12 text-text-ink" />
            </label>
            <label className="text-small text-text-secondary">
              {labels['homes.pets']}
              <select name="pets" defaultValue={searchParams?.pets || 'any'} className="mt-8 h-48 w-full rounded-lg border border-border-line bg-white px-12 text-text-ink">
                <option value="any">{labels['homes.pets_any']}</option>
                <option value="yes">{labels['homes.pets_yes']}</option>
                <option value="no">{labels['homes.pets_no']}</option>
              </select>
            </label>
          </> : null}
          <label className="text-small text-text-secondary">
            {labels['homes.max_price']}
            <input name="maxPrice" type="number" min="0" step="1000" defaultValue={searchParams?.maxPrice || ''} className="mt-8 h-48 w-full rounded-lg border border-border-line bg-white px-12 text-text-ink" />
          </label>
          <button type="submit" className="h-48 self-end rounded-lg bg-brand-andaman px-20 text-small font-semibold text-white hover:bg-brand-deep">
            {labels['homes.apply_filters']} →
          </button>
        </div>
        <details className="mt-16 border-t border-border-line pt-16">
          <summary className="cursor-pointer text-small font-semibold text-brand-andaman">{labels['homes.filters']}</summary>
          <div className="mt-16 grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-small text-text-secondary">
              {labels['homes.type_filter']}
              <select name="type" defaultValue={type} className="mt-8 h-48 w-full rounded-lg border border-border-line bg-white px-12 text-text-ink">
                <option value="">{labels['homes.all_types']}</option>
                <option value="condo">{labels['homes.type.condo']}</option>
                <option value="villa">{labels['homes.type.villa']}</option>
                <option value="townhouse">{labels['homes.type.townhouse']}</option>
              </select>
            </label>
            <label className="text-small text-text-secondary">
              {labels['homes.bedrooms_filter']}
              <input name="bedrooms" type="number" min="0" defaultValue={searchParams?.bedrooms || ''} className="mt-8 h-48 w-full rounded-lg border border-border-line bg-white px-12 text-text-ink" />
            </label>
            <label className="text-small text-text-secondary">
              {labels['homes.min_area']}
              <input name="minArea" type="number" min="0" defaultValue={searchParams?.minArea || ''} className="mt-8 h-48 w-full rounded-lg border border-border-line bg-white px-12 text-text-ink" />
            </label>
            <label className="text-small text-text-secondary">
              {labels['homes.max_area']}
              <input name="maxArea" type="number" min="0" defaultValue={searchParams?.maxArea || ''} className="mt-8 h-48 w-full rounded-lg border border-border-line bg-white px-12 text-text-ink" />
            </label>
            <label className="text-small text-text-secondary">
              {labels['homes.min_price']}
              <input name="minPrice" type="number" min="0" step="1000" defaultValue={searchParams?.minPrice || ''} className="mt-8 h-48 w-full rounded-lg border border-border-line bg-white px-12 text-text-ink" />
            </label>
          </div>
        </details>
        <p className="mt-12 text-small text-text-secondary">{labels['homes.price_note']}</p>
      </form>

      <div className="grid gap-24 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div>
          {homes.length ? <div className="grid gap-16">
            {homes.map(home => {
              const price = home.priceThb[intent] ?? null;
              return <Link href={detailHref(home.id)} key={home.id}
                className="group overflow-hidden rounded-2xl border border-border-line bg-surface-paper transition-shadow hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-andaman md:grid md:grid-cols-[260px_minmax(0,1fr)]">
                {home.imageUrl ? <Image src={home.imageUrl} alt={home.name} width={760} height={500}
                  className="h-full min-h-[220px] w-full object-cover" /> :
                  <div className="min-h-[220px] bg-surface-ivory"/>}
                <div className="flex min-w-0 flex-col justify-between p-20">
                  <div>
                    <p className="text-small font-semibold text-brand-andaman">{home.project.name}</p>
                    <h2 className="mt-4 font-display text-heading-3 font-semibold text-text-ink">{home.name}</h2>
                    <p className="mt-8 text-small text-text-secondary">
                      {home.bedrooms} {labels['homes.bedrooms']} · {home.bathrooms} {labels['homes.bathrooms']}
                      {home.sizeSqm ? ' · '+home.sizeSqm+' '+labels['homes.area'] : ''}
                    </p>
                    {intent === 'rent' && home.leaseTerms ? (
                      <div className="mt-12 flex flex-wrap gap-8 text-micro text-text-secondary">
                        {home.leaseTerms.minimumLeaseMonths ? <span className="rounded-full bg-surface-ivory px-12 py-8">{labels['homes.minimum_term']}: {labels['homes.detail.months_unit'].replace('{count}', String(home.leaseTerms.minimumLeaseMonths))}</span> : null}
                        {home.leaseTerms.securityDepositMonths ? <span className="rounded-full bg-surface-ivory px-12 py-8">{labels['homes.deposit']}: {labels['homes.detail.months_unit'].replace('{count}', String(home.leaseTerms.securityDepositMonths))}</span> : null}
                        {home.leaseTerms.availableFrom ? <span className="rounded-full bg-surface-ivory px-12 py-8">{labels['homes.available_from']}: {home.leaseTerms.availableFrom}</span> : null}
                      </div>
                    ) : null}
                    {home.responsibility.verified && home.responsibility.organizationName ? (
                      <p className="mt-12 text-micro font-medium text-brand-andaman">
                        {labels['homes.responsibility_unit'].replace('{org}', home.responsibility.organizationName)}
                      </p>
                    ) : null}
                  </div>
                  <div className="mt-20 flex flex-wrap items-end justify-between gap-12 border-t border-border-line pt-16">
                    <p className="font-display text-body-strong font-semibold text-text-ink">
                      {price !== null
                        ? (intent === 'buy' ? labels['homes.sale_price'] : labels['homes.monthly_price']) + ': ฿' + price.toLocaleString()
                        : labels['homes.price']}
                    </p>
                    <span className="text-small font-semibold text-brand-andaman group-hover:underline">{labels['homes.details']} →</span>
                  </div>
                </div>
              </Link>;
            })}
          </div> : <div role="status" className="rounded-xl border border-border-line bg-surface-paper p-24 text-body text-text-secondary">
            {labels['homes.empty']}
          </div>}
        </div>

        <aside className="rounded-2xl border border-border-line bg-surface-paper p-20 shadow-card lg:sticky lg:top-96">
          <p className="text-kicker uppercase text-brand-andaman">{labels['homes.filters']}</p>
          <h2 className="mt-8 font-display text-heading-2 font-semibold text-text-ink">{labels['homes.contact']}</h2>
          <dl className="mt-20 space-y-12 text-small">
            <div className="flex justify-between gap-12"><dt className="text-text-secondary">{labels['homes.area_filter']}</dt><dd className="text-right font-semibold text-text-ink">{area || labels['homes.all_areas']}</dd></div>
            {intent === 'rent' ? <>
              <div className="flex justify-between gap-12"><dt className="text-text-secondary">{labels['homes.move_in']}</dt><dd className="text-right font-semibold text-text-ink">{searchParams?.moveIn || '—'}</dd></div>
              <div className="flex justify-between gap-12"><dt className="text-text-secondary">{labels['homes.lease_term']}</dt><dd className="text-right font-semibold text-text-ink">{searchParams?.leaseTermMonths || '—'}</dd></div>
              <div className="flex justify-between gap-12"><dt className="text-text-secondary">{labels['homes.pets']}</dt><dd className="text-right font-semibold text-text-ink">{searchParams?.pets === 'yes' ? labels['homes.pets_yes'] : searchParams?.pets === 'no' ? labels['homes.pets_no'] : labels['homes.pets_any']}</dd></div>
            </> : null}
            <div className="flex justify-between gap-12"><dt className="text-text-secondary">{labels['homes.max_price']}</dt><dd className="text-right font-semibold text-text-ink">{searchParams?.maxPrice ? '฿'+Number(searchParams.maxPrice).toLocaleString() : '—'}</dd></div>
          </dl>
          <p className="mt-20 border-t border-border-line pt-16 text-small text-text-secondary">{labels['homes.price_note']}</p>
          <a href="#lead-form" className="mt-20 flex min-h-48 items-center justify-center rounded-lg bg-brand-andaman px-20 text-small font-semibold text-white hover:bg-brand-deep">
            {labels['homes.contact']} →
          </a>
        </aside>
      </div>
    </div>

    <section aria-label={labels['homes.contact']}>
      <LeadFormSection audience={intent==='buy'?'buyers':'renters'}
        initialMessage={intent==='buy'?labels['homes.inquiry.buy']:labels['homes.inquiry.rent']} />
    </section>
  </main>;
}
