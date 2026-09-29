import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { getPublicCommercialHomeById, type HomeIntent } from '@/modules/projects/commercial-discovery';
import { LeadFormSection } from '@/app/(public)/lead-form-section';

export const dynamic = 'force-dynamic';

export default async function CommercialHomePage({ params, searchParams }: {
  params: { id: string }; searchParams?: { intent?: string };
}) {
  const home = await getPublicCommercialHomeById(prisma, params.id);
  if (!home) notFound();
  const requested: HomeIntent = searchParams?.intent === 'rent' ? 'rent' : 'buy';
  const intent: HomeIntent = home.intents.includes(requested) ? requested : home.intents[0];
  const labels = await getLabels({
    'homes.detail.inquiry.buy': 'Purchase enquiry',
    'homes.detail.inquiry.rent': 'Long-term rental enquiry',
    'homes.detail.inquiry.prompt': 'Please provide current availability and terms.',
    'homes.detail.back': 'All available homes',
    'homes.detail.title': 'Property enquiry',
    'homes.detail.bedrooms': 'Bedrooms',
    'homes.detail.bathrooms': 'Bathrooms',
    'homes.detail.size': 'Interior area',
    'homes.detail.price': 'Price and individual terms are provided after enquiry and verification.',
    'homes.detail.buy': 'Purchase enquiry',
    'homes.detail.rent': 'Long-term rental enquiry',
    'homes.detail.legal': 'Listing authority has been reviewed for this commercial mode. Legal title, contract and transaction details must be confirmed during due diligence.',
  });
  const inquiry = (intent === 'buy' ? labels['homes.detail.inquiry.buy'] : labels['homes.detail.inquiry.rent'])+
    ': '+home.name+' / '+home.project.name+' ('+home.id+'). '+labels['homes.detail.inquiry.prompt'];
  return <main className="min-h-screen bg-surface-ivory">
    <div className="mx-auto max-w-5xl px-20 py-32 md:px-32">
      <Link href={'/homes?intent='+intent} className="text-small font-semibold text-brand-andaman">← {labels['homes.detail.back']}</Link>
      <p className="mt-24 text-kicker uppercase tracking-wider text-brand-andaman">{home.project.name}</p>
      <h1 className="mt-8 font-display text-display-xl font-semibold text-text-ink">{home.name}</h1>
      {home.imageUrl ? <Image src={home.imageUrl} alt={home.name} width={1200} height={760}
        className="mt-24 aspect-[16/10] w-full rounded-xl object-cover"/> : null}
      <div className="mt-24 grid grid-cols-2 gap-12 md:grid-cols-3">
        <div className="rounded-lg border border-border-line bg-surface-paper p-20">
          <p className="text-small text-text-secondary">{labels['homes.detail.bedrooms']}</p><strong>{home.bedrooms}</strong>
        </div>
        <div className="rounded-lg border border-border-line bg-surface-paper p-20">
          <p className="text-small text-text-secondary">{labels['homes.detail.bathrooms']}</p><strong>{home.bathrooms}</strong>
        </div>
        {home.sizeSqm ? <div className="rounded-lg border border-border-line bg-surface-paper p-20">
          <p className="text-small text-text-secondary">{labels['homes.detail.size']}</p><strong>{home.sizeSqm} m²</strong>
        </div> : null}
      </div>
      <p className="mt-24 text-body text-text-secondary">{labels['homes.detail.price']}</p>
      <p className="mt-12 text-small text-text-secondary">{labels['homes.detail.legal']}</p>
      <div className="mt-24 flex flex-wrap gap-8">
        {home.intents.map(mode => <Link key={mode} href={'/homes/'+encodeURIComponent(home.id)+'?intent='+mode}
          aria-current={intent===mode?'page':undefined}
          className={'rounded-full border px-20 py-10 text-small font-semibold '+
            (intent===mode?'border-brand-deep bg-brand-deep text-white':'border-border-line bg-surface-paper')}>
          {mode==='buy'?labels['homes.detail.buy']:labels['homes.detail.rent']}
        </Link>)}
      </div>
    </div>
    <LeadFormSection audience={intent==='buy'?'buyers':'renters'} initialMessage={inquiry}/>
  </main>;
}
