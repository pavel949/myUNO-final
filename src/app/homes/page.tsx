import Link from 'next/link';
import Image from 'next/image';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { listPublicCommercialHomes, type HomeIntent } from '@/modules/projects/commercial-discovery';
import { LeadFormSection } from '@/app/(public)/lead-form-section';

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
};

const positiveNumber = (value?: string) => {
  const parsed = value ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

export default async function HomesPage({ searchParams }: { searchParams?: SearchParams }) {
  const intent: HomeIntent = searchParams?.intent === 'rent' ? 'rent' : 'buy';
  const [allHomes, labels] = await Promise.all([
    listPublicCommercialHomes(prisma, intent).catch(() => []),
    getLabels({
      'homes.kicker': 'myUNO · REAL ESTATE',
      'homes.inquiry.buy': 'I am looking to purchase a property in Phuket.',
      'homes.inquiry.rent': 'I am looking for a long-term rental in Phuket.',
      'homes.title': 'Homes in Phuket',
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
    }),
  ]);

  const area = (searchParams?.area || '').trim();
  const type = (searchParams?.type || '').trim();
  const bedrooms = positiveNumber(searchParams?.bedrooms);
  const minArea = positiveNumber(searchParams?.minArea);
  const maxArea = positiveNumber(searchParams?.maxArea);
  const minPrice = positiveNumber(searchParams?.minPrice);
  const maxPrice = positiveNumber(searchParams?.maxPrice);

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

  const areas = [...new Set(allHomes.map((home) => home.project.areaSlug).filter((value): value is string => Boolean(value)))].sort();
  const modeLink = (value: HomeIntent) => '/homes?intent=' + value;

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

      <form method="get" className="mb-32 rounded-2xl border border-border-line bg-surface-paper p-16 md:p-20">
        <input type="hidden" name="intent" value={intent} />
        <div className="flex items-center justify-between gap-16">
          <h2 className="font-display text-title font-semibold text-text-ink">{labels['homes.filters']}</h2>
          <Link href={modeLink(intent)} className="text-small font-semibold text-brand-andaman hover:underline">
            {labels['homes.clear_filters']}
          </Link>
        </div>
        <div className="mt-16 grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-small text-text-secondary">
            {labels['homes.area_filter']}
            <select name="area" defaultValue={area} className="mt-8 h-48 w-full rounded-lg border border-border-line bg-white px-12 text-text-ink">
              <option value="">{labels['homes.all_areas']}</option>
              {areas.map((slug) => <option key={slug} value={slug}>{slug}</option>)}
            </select>
          </label>
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
            {searchParams?.projectId && <input type="hidden" name="projectId" value={searchParams.projectId} />}
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
          <label className="text-small text-text-secondary">
            {labels['homes.max_price']}
            <input name="maxPrice" type="number" min="0" step="1000" defaultValue={searchParams?.maxPrice || ''} className="mt-8 h-48 w-full rounded-lg border border-border-line bg-white px-12 text-text-ink" />
          </label>
          <button type="submit" className="h-48 self-end rounded-lg bg-brand-andaman px-20 text-small font-semibold text-white hover:bg-brand-deep">
            {labels['homes.apply_filters']} →
          </button>
        </div>
        <p className="mt-12 text-small text-text-secondary">{labels['homes.price_note']}</p>
      </form>

      {homes.length ? <div className="grid gap-20 sm:grid-cols-2 lg:grid-cols-3">
        {homes.map(home => {
          const price = home.priceThb[intent] ?? null;
          return <Link href={'/homes/'+encodeURIComponent(home.id)+'?intent='+intent} key={home.id}
            className="group overflow-hidden rounded-xl border border-border-line bg-surface-paper hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-andaman">
            {home.imageUrl ? <Image src={home.imageUrl} alt={home.name} width={760} height={500}
              className="aspect-[3/2] w-full object-cover" /> :
              <div className="aspect-[3/2] bg-surface-ivory"/>}
            <div className="space-y-8 p-20">
              <p className="text-small text-brand-andaman">{home.project.name}</p>
              <h2 className="font-display text-heading-3 font-semibold text-text-ink">{home.name}</h2>
              <p className="text-small text-text-secondary">
                {home.bedrooms} {labels['homes.bedrooms']} · {home.bathrooms} {labels['homes.bathrooms']}
                {home.sizeSqm ? ' · '+home.sizeSqm+' '+labels['homes.area'] : ''}
              </p>
              <p className="text-small font-semibold text-text-ink">
                {price !== null
                  ? (intent === 'buy' ? labels['homes.sale_price'] : labels['homes.monthly_price']) + ': ฿' + price.toLocaleString()
                  : labels['homes.price']}
              </p>
              <span className="inline-block text-small font-semibold text-brand-andaman group-hover:underline">{labels['homes.details']} →</span>
            </div>
          </Link>;
        })}
      </div> : <div role="status" className="rounded-xl border border-border-line bg-surface-paper p-24 text-body text-text-secondary">
        {labels['homes.empty']}
      </div>}
    </div>

    <section aria-label={labels['homes.contact']}>
      <LeadFormSection audience={intent==='buy'?'buyers':'renters'}
        initialMessage={intent==='buy'?labels['homes.inquiry.buy']:labels['homes.inquiry.rent']} />
    </section>
  </main>;
}
