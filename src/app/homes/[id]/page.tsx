import { UI_LOCALE } from '@/lib/format';
import Link from 'next/link';
import { UnitPhotoMosaic } from '@/components/UnitPhotoMosaic';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { getPublicCommercialHomeById, type HomeIntent } from '@/modules/projects/commercial-discovery';
import { LeadFormSection } from '@/app/(public)/lead-form-section';
import { track } from '@/modules/analytics';
import { getDestination } from '@/modules/destinations';
import { getRequestLocale } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function CommercialHomePage({ params, searchParams }: {
  params: { id: string }; searchParams?: {
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
    projectId?: string;
  };
}) {
  const home = await getPublicCommercialHomeById(prisma, params.id);
  if (!home) notFound();
  const requested: HomeIntent = searchParams?.intent === 'rent' ? 'rent' : 'buy';
  const intent: HomeIntent = home.intents.includes(requested) ? requested : home.intents[0];

  await track(prisma, 'unit_opened', {
    unitId: home.id,
    projectId: home.project.id,
    destination: getDestination().key,
    locale: getRequestLocale(),
    intent: intent === 'rent' ? 'monthly' : 'buy',
    source: 'commercial_home_detail',
  }).catch(() => null);

  const labels = await getLabels({
    'homes.detail.inquiry.buy': 'Purchase enquiry',
    'homes.detail.inquiry.rent': 'Long-term rental enquiry',
    'homes.detail.inquiry.prompt': 'Please provide current availability and terms.',
    'homes.detail.back': 'All available homes',
    'homes.detail.title': 'Property enquiry',
    'homes.detail.bedrooms': 'Bedrooms',
    'homes.detail.bathrooms': 'Bathrooms',
    'homes.detail.size': 'Interior area',
    'homes.detail.size_unit': 'sqm',
    'homes.detail.price': 'Price and individual terms are provided after enquiry and verification.',
    'homes.detail.buy': 'Purchase enquiry',
    'homes.detail.rent': 'Long-term rental enquiry',
    'homes.detail.legal': 'Listing authority has been reviewed for this commercial mode. Legal title, contract and transaction details must be confirmed during due diligence.',
    'homes.detail.show_all_photos': 'Show all {count} photos',
    'homes.detail.monthly_rent': 'Monthly rent',
    'homes.detail.minimum_term': 'Minimum lease',
    'homes.detail.maximum_term': 'Maximum lease',
    'homes.detail.deposit': 'Security deposit',
    'homes.detail.advance': 'Advance rent',
    'homes.detail.available_from': 'Available from',
    'homes.detail.pets_yes': 'Pets allowed',
    'homes.detail.pets_no': 'Pets not allowed',
    'homes.detail.utilities_included': 'Included utilities',
    'homes.detail.utilities_excluded': 'Additional utilities',
    'homes.detail.responsibility': 'Managed by {org}',
    'homes.detail.per_month': 'per month',
    'homes.detail.months_unit': '{count} months',
  });
  const leaseContext = intent === 'rent'
    ? [
        searchParams?.moveIn ? 'move-in ' + searchParams.moveIn : null,
        searchParams?.leaseTermMonths ? searchParams.leaseTermMonths + ' months' : null,
        searchParams?.pets === 'yes' ? 'pet-friendly required' : null,
      ].filter(Boolean).join(', ')
    : '';
  const inquiry = (intent === 'buy' ? labels['homes.detail.inquiry.buy'] : labels['homes.detail.inquiry.rent'])+
    ': '+home.name+' / '+home.project.name+' ('+home.id+'). '+
    (leaseContext ? 'Search context: '+leaseContext+'. ' : '')+
    labels['homes.detail.inquiry.prompt'];

  const backParams = new URLSearchParams({ intent });
  for (const key of ['area', 'type', 'bedrooms', 'minArea', 'maxArea', 'minPrice', 'maxPrice', 'moveIn', 'leaseTermMonths', 'pets', 'projectId'] as const) {
    const value = searchParams?.[key];
    if (value) backParams.set(key, value);
  }
  return <main className="min-h-screen bg-surface-ivory">
    <div className="mx-auto max-w-5xl px-20 py-32 md:px-32">
      <Link href={'/homes?'+backParams.toString()} className="text-small font-semibold text-brand-andaman">← {labels['homes.detail.back']}</Link>
      <p className="mt-24 text-kicker uppercase tracking-wider text-brand-andaman">{home.project.name}</p>
      <h1 className="mt-8 font-display text-display-xl font-semibold text-text-ink">{home.name}</h1>
      <div className="mt-24">
        <UnitPhotoMosaic
          images={home.images}
          alt={home.name}
          showAllLabel={labels['homes.detail.show_all_photos'].replace('{count}', String(home.images.length))}
        />
      </div>
      <div className="mt-24 grid gap-24 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div>
          <div className="grid grid-cols-2 gap-12 md:grid-cols-3">
            <div className="rounded-lg border border-border-line bg-surface-paper p-20">
              <p className="text-small text-text-secondary">{labels['homes.detail.bedrooms']}</p><strong>{home.bedrooms}</strong>
            </div>
            <div className="rounded-lg border border-border-line bg-surface-paper p-20">
              <p className="text-small text-text-secondary">{labels['homes.detail.bathrooms']}</p><strong>{home.bathrooms}</strong>
            </div>
            {home.sizeSqm ? <div className="rounded-lg border border-border-line bg-surface-paper p-20">
              <p className="text-small text-text-secondary">{labels['homes.detail.size']}</p><strong>{home.sizeSqm} {labels['homes.detail.size_unit']}</strong>
            </div> : null}
          </div>

          {intent === 'rent' && home.leaseTerms ? (
            <div className="mt-24 grid gap-16 rounded-2xl border border-border-line bg-surface-paper p-20 md:grid-cols-2">
              {home.leaseTerms.monthlyRentThb ? <p><span className="text-small text-text-secondary">{labels['homes.detail.monthly_rent']}</span><br/><strong>฿{home.leaseTerms.monthlyRentThb.toLocaleString(UI_LOCALE)} {labels['homes.detail.per_month']}</strong></p> : null}
              {home.leaseTerms.minimumLeaseMonths ? <p><span className="text-small text-text-secondary">{labels['homes.detail.minimum_term']}</span><br/><strong>{labels['homes.detail.months_unit'].replace('{count}', String(home.leaseTerms.minimumLeaseMonths))}</strong></p> : null}
              {home.leaseTerms.maximumLeaseMonths ? <p><span className="text-small text-text-secondary">{labels['homes.detail.maximum_term']}</span><br/><strong>{labels['homes.detail.months_unit'].replace('{count}', String(home.leaseTerms.maximumLeaseMonths))}</strong></p> : null}
              {home.leaseTerms.securityDepositMonths ? <p><span className="text-small text-text-secondary">{labels['homes.detail.deposit']}</span><br/><strong>{labels['homes.detail.months_unit'].replace('{count}', String(home.leaseTerms.securityDepositMonths))}</strong></p> : null}
              {home.leaseTerms.advanceRentMonths ? <p><span className="text-small text-text-secondary">{labels['homes.detail.advance']}</span><br/><strong>{labels['homes.detail.months_unit'].replace('{count}', String(home.leaseTerms.advanceRentMonths))}</strong></p> : null}
              {home.leaseTerms.availableFrom ? <p><span className="text-small text-text-secondary">{labels['homes.detail.available_from']}</span><br/><strong>{home.leaseTerms.availableFrom}</strong></p> : null}
              {home.leaseTerms.petsAllowed !== null ? <p><strong>{home.leaseTerms.petsAllowed ? labels['homes.detail.pets_yes'] : labels['homes.detail.pets_no']}</strong></p> : null}
              {home.leaseTerms.utilitiesIncluded.length ? <p><span className="text-small text-text-secondary">{labels['homes.detail.utilities_included']}</span><br/><strong>{home.leaseTerms.utilitiesIncluded.join(', ')}</strong></p> : null}
              {home.leaseTerms.utilitiesExcluded.length ? <p><span className="text-small text-text-secondary">{labels['homes.detail.utilities_excluded']}</span><br/><strong>{home.leaseTerms.utilitiesExcluded.join(', ')}</strong></p> : null}
            </div>
          ) : (
            <p className="mt-24 text-body text-text-secondary">{labels['homes.detail.price']}</p>
          )}

          {home.responsibility.verified && home.responsibility.organizationName ? (
            <p className="mt-16 text-small font-semibold text-brand-andaman">
              {labels['homes.detail.responsibility'].replace('{org}', home.responsibility.organizationName)}
            </p>
          ) : null}
          <p className="mt-12 text-small text-text-secondary">{labels['homes.detail.legal']}</p>
          <div className="mt-24 flex flex-wrap gap-8">
            {home.intents.map(mode => <Link key={mode} href={'/homes/'+encodeURIComponent(home.id)+'?intent='+mode}
              aria-current={intent===mode?'page':undefined}
              className={'rounded-full border px-20 py-12 text-small font-semibold '+
                (intent===mode?'border-brand-deep bg-brand-deep text-white':'border-border-line bg-surface-paper')}>
              {mode==='buy'?labels['homes.detail.buy']:labels['homes.detail.rent']}
            </Link>)}
          </div>
        </div>

        <aside className="rounded-2xl border border-border-line bg-surface-paper p-20 shadow-card lg:sticky lg:top-96">
          <p className="text-kicker uppercase text-brand-andaman">{home.project.name}</p>
          <h2 className="mt-8 font-display text-heading-2 font-semibold text-text-ink">
            {intent === 'buy' ? labels['homes.detail.buy'] : labels['homes.detail.rent']}
          </h2>
          {intent === 'rent' && home.leaseTerms?.monthlyRentThb ? (
            <p className="mt-16 font-display text-heading-2 font-semibold text-text-ink">
              ฿{home.leaseTerms.monthlyRentThb.toLocaleString(UI_LOCALE)} {labels['homes.detail.per_month']}
            </p>
          ) : (
            <p className="mt-16 text-small text-text-secondary">{labels['homes.detail.price']}</p>
          )}
          {intent === 'rent' && home.leaseTerms ? (
            <dl className="mt-20 space-y-12 text-small">
              {home.leaseTerms.minimumLeaseMonths ? <div className="flex justify-between gap-12"><dt className="text-text-secondary">{labels['homes.detail.minimum_term']}</dt><dd className="font-semibold text-text-ink">{labels['homes.detail.months_unit'].replace('{count}', String(home.leaseTerms.minimumLeaseMonths))}</dd></div> : null}
              {home.leaseTerms.securityDepositMonths ? <div className="flex justify-between gap-12"><dt className="text-text-secondary">{labels['homes.detail.deposit']}</dt><dd className="font-semibold text-text-ink">{labels['homes.detail.months_unit'].replace('{count}', String(home.leaseTerms.securityDepositMonths))}</dd></div> : null}
              {home.leaseTerms.availableFrom ? <div className="flex justify-between gap-12"><dt className="text-text-secondary">{labels['homes.detail.available_from']}</dt><dd className="font-semibold text-text-ink">{home.leaseTerms.availableFrom}</dd></div> : null}
            </dl>
          ) : null}
          <a href="#lead-form" className="mt-20 flex min-h-48 items-center justify-center rounded-lg bg-brand-andaman px-20 text-center text-small font-semibold text-white hover:bg-brand-deep">
            {intent === 'buy' ? labels['homes.detail.inquiry.buy'] : labels['homes.detail.inquiry.rent']} →
          </a>
        </aside>
      </div>
    </div>
    <LeadFormSection audience={intent==='buy'?'buyers':'renters'} initialMessage={inquiry}/>
  </main>;
}
