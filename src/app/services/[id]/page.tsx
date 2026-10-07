import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { PageHeading, Panel } from '@/components/premium/StitchPage';
import { Breadcrumb } from '@/components/Breadcrumb';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { track } from '@/modules/analytics';
import { getPublicMarketplaceServiceDetail } from '@/modules/services';
import { prisma } from '@/lib/prisma';
import { getConfig } from '@/modules/config';
import OrderWizard from './order-wizard';
import { formatServicePriceLabel } from './price-label';
import { getDestination } from '@/modules/destinations';
import { servicePresentationImage } from '@/lib/presentation-media';

export const dynamic = 'force-dynamic';

interface ServiceDetail {
  id: string;
  title: string;
  description: string | null;
  categoryKey: string;
  priceModel: string;
  basePriceThb: number | null;
  durationMin: number | null;
  advanceNoticeHours: number;
  coverUrl: string | null;
  mediaUrls: string[];
  provider: {
    id: string;
    name: string;
    description: string | null;
    vetted: boolean;
    vettedAt: string | null;
  };
}

export default async function ServiceDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { bookingId?: string; projectId?: string; unitId?: string };
}) {
  const { id } = params;
  const bookingId = searchParams.bookingId || null;
  // A guest arrives with a stay. Everyone else — a resident, an owner, an MC
  // member — arrives with a building or a unit instead. Without this the order
  // API fell through to its single-project guess, which is correct only while
  // exactly one project exists and fails the day a second one goes live.
  const projectId = searchParams.projectId || null;
  const unitId = searchParams.unitId || null;

  // Read through the services module directly: a server-side fetch of our own
  // API with a relative URL cannot resolve, which left this page always 404.
  const service: ServiceDetail | null = await getPublicMarketplaceServiceDetail(
    prisma, id, getRequestLocale(), projectId ?? undefined
  ).catch(() => null);
  if (!service) {
    notFound();
  }
  const viewer = await getCurrentUser().catch(() => null);
  const serviceEventDimensions = {
    serviceId: service.id,
    identityId: viewer?.identityId,
    categoryKey: service.categoryKey,
    projectId: projectId ?? undefined,
    destination: getDestination().key,
    locale: getRequestLocale(),
    source: 'service_detail',
  };
  await Promise.all([
    track(prisma, 'service_service_viewed', serviceEventDimensions),
    track(prisma, 'service_opened', serviceEventDimensions),
  ]).catch(() => null);

  const labels = await getLabels({
    'landing.services.no_photo': 'Illustrative image',
    'services.breadcrumb_home': 'Home',
    'services.breadcrumb_services': 'Services',
    'services.breadcrumb_detail': 'Service Details',
    'services.detail.title': 'Service',
    'services.detail.by_provider': 'By {provider}',
    'services.detail.vetted_badge': 'Vetted',
    'services.detail.price_model': 'Price model',
    'services.detail.fixed': 'Fixed price',
    'services.detail.per_hour': 'Per hour',
    'services.detail.per_person': 'Per person',
    'services.detail.quote': 'Quote on request',
    'services.detail.duration': 'Typical duration',
    'services.detail.duration_hours': '{minutes} min',
    'services.detail.advance_notice': 'Advance notice required',
    'services.detail.advance_notice_hours': '{hours}h',
    'services.detail.advance_notice_none': 'None',
    'services.detail.about_provider': 'About the provider',
    'services.detail.order': 'Order this service',
    'services.detail.photos': 'Photos',
    'services.detail.back': 'Back to services',
    'services.wizard.title': 'Your order',
    'services.wizard.when': 'When',
    'services.wizard.quantity': 'Quantity',
    'services.wizard.note': 'Note to provider (optional)',
    'services.wizard.total_preview': 'Total',
    'services.wizard.place': 'Order — ฿{total}',
    'services.wizard.place_no_total': 'Place order',
    'services.wizard.pay_title': 'Order placed — choose how to pay',
    'services.wizard.pay_subtitle': 'Pay now by card, or in cash when the service is delivered.',
    'services.wizard.pay_card': 'Pay by card',
    'services.wizard.pay_cash': 'Cash on fulfilment',
    'services.wizard.pay_cash_note': 'Cash payments are recorded by our staff with a receipt number.',
    'services.wizard.quote_title': 'Priced individually',
    'services.wizard.quote_body': 'This service is quoted for your dates and party — the concierge will confirm the price with you directly.',
    'services.wizard.quote_whatsapp': 'Ask the concierge on WhatsApp',
    'services.wizard.quote_messages': 'Message us',
    'services.wizard.error_generic': 'Could not place the order. Please try again.',
  });

  // Quote CTA: the concierge WhatsApp is a project-scoped parameter — when
  // the guest arrives from a stay, resolve it through their booking's project.
  let whatsappNumber: string | null = null;
  try {
    let scopedProjectId: string | undefined = projectId ?? undefined;
    if (bookingId) {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { projectId: true },
      });
      scopedProjectId = booking?.projectId ?? scopedProjectId;
    }
    const value = await getConfig(prisma, 'comms.whatsapp_number',
      scopedProjectId ? { projectId: scopedProjectId } : undefined);
    whatsappNumber = typeof value === 'string' && value.trim() ? value.trim() : null;
  } catch {
    whatsappNumber = null;
  }

  const priceModelLabel: Record<string, string> = {
    fixed: labels['services.detail.fixed'],
    per_hour: labels['services.detail.per_hour'],
    per_person: labels['services.detail.per_person'],
    quote: labels['services.detail.quote'],
  };

  const breadcrumbs = [
    { label: labels['services.breadcrumb_home'], href: '/' },
    { label: labels['services.breadcrumb_services'], href: '/services' },
    { label: labels['services.breadcrumb_detail'], current: true },
  ];
  const presentation = servicePresentationImage(service.id, service.coverUrl, service.categoryKey);

  return (
    <main className="stitch-workspace">
      <Breadcrumb items={breadcrumbs} />
      <div className="stitch-page">
      <div className="grid min-w-0 gap-24 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
      <div className="min-w-0 space-y-24">
        {/* Cover image */}
          <figure className="relative mb-24 rounded-lg overflow-hidden bg-surface-paper">
            <Image
              src={presentation.src}
              alt={presentation.illustrative ? '' : service.title}
              width={640}
              height={384}
              priority
              className="aspect-[4/3] w-full object-cover"
            />
            {presentation.illustrative ? <figcaption className="absolute bottom-12 left-12 rounded-full bg-brand-deep/90 px-12 py-4 text-small text-white">{labels['landing.services.no_photo']}</figcaption> : null}
          </figure>

        {/* Title & provider */}
        <PageHeading title={service.title} subtitle={service.description || undefined}>
          <div className="mt-12 flex flex-wrap items-center gap-8 text-body text-text-secondary">
            <span>
              {labels['services.detail.by_provider'].replace('{provider}', service.provider.name)}
            </span>
            {service.provider.vetted && (
              <span className="inline-flex items-center gap-4 px-8 py-4 bg-state-success-soft bg-opacity-10 text-state-success rounded-full text-small font-semibold">
                ✓ {labels['services.detail.vetted_badge']}
              </span>
            )}
          </div>
        </PageHeading>

        {/* Key details grid */}
        <div className="stitch-panel grid grid-cols-1 gap-16 p-20 sm:grid-cols-3">
          <div className="min-w-0">
            <p className="text-small text-text-secondary mb-8">{labels['services.detail.price_model']}</p>
            <p className="font-display text-subtitle font-semibold text-text-ink">
              {priceModelLabel[service.priceModel] || service.priceModel}
            </p>
            {service.basePriceThb !== null && (
              <p className="text-body text-text-secondary mt-4">
                {/* service.basePriceThb is satang from the DB; the raw satang
                    value is still passed to OrderWizard below, unconverted,
                    since it feeds order-total math — see price-label.ts. */}
                {formatServicePriceLabel(service.priceModel, service.basePriceThb)}
              </p>
            )}
          </div>

          {service.durationMin !== null && (
            <div className="min-w-0">
              <p className="text-small text-text-secondary mb-8">{labels['services.detail.duration']}</p>
              <p className="font-display text-subtitle font-semibold text-text-ink">
                {labels['services.detail.duration_hours'].replace('{minutes}', String(service.durationMin))}
              </p>
            </div>
          )}

          <div className="min-w-0">
            <p className="text-small text-text-secondary mb-8">
              {labels['services.detail.advance_notice']}
            </p>
            <p className="font-display text-subtitle font-semibold text-text-ink">
              {service.advanceNoticeHours > 0
                ? labels['services.detail.advance_notice_hours'].replace('{hours}', String(service.advanceNoticeHours))
                : labels['services.detail.advance_notice_none']}
            </p>
          </div>
        </div>

        {/* Provider details */}
        {service.provider.description && (
          <Panel title={labels['services.detail.about_provider']}>
            <p className="text-body text-text-secondary">{service.provider.description}</p>
          </Panel>
        )}

        {/* Gallery */}
        {service.mediaUrls.length > 0 && (
          <div className="mb-24">
            <h2 className="font-display text-title font-semibold text-text-ink mb-12">{labels['services.detail.photos']}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-12 rounded-lg overflow-hidden">
              {service.mediaUrls.map((url, idx) => (
                <Image
                  key={idx}
                  src={url}
                  alt={`${service.title} ${idx + 1}`}
                  width={320}
                  height={160}
                  className="w-full h-40 object-cover rounded-lg"
                />
              ))}
            </div>
          </div>
        )}

      </div>
        {/* SA-2: same canonical ordering surface in a contextual rail. */}
        <aside className="min-w-0 lg:sticky lg:top-96">
          <OrderWizard
            service={{
              id: service.id,
              title: service.title,
              priceModel: service.priceModel,
              basePriceThb: service.basePriceThb,
            }}
            bookingId={bookingId}
            projectId={projectId}
            unitId={unitId}
            whatsappNumber={whatsappNumber}
            labels={labels}
          />
          <div className="mt-16">
            <Link
              href={`/services?${new URLSearchParams({
                ...(bookingId ? { bookingId } : {}),
                ...(projectId ? { projectId } : {}),
                ...(unitId ? { unitId } : {}),
              }).toString()}`}
              className="text-small font-semibold text-brand-andaman hover:underline"
            >
              ← {labels['services.detail.back']}
            </Link>
          </div>
        </aside>
      </div>
      </div>
    </main>
  );
}
