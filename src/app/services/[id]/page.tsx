import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getLabels } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { getConfig } from '@/modules/config';
import OrderWizard from './order-wizard';
import { formatServicePriceLabel } from './price-label';

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
  searchParams: { bookingId?: string };
}) {
  const { id } = params;
  const bookingId = searchParams.bookingId || null;

  let service: ServiceDetail | null = null;
  try {
    const res = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/services/${id}`, {
      cache: 'no-store',
    });
    if (res.ok) {
      service = await res.json();
    }
  } catch {
    // Service fetch failed
  }

  if (!service) {
    notFound();
  }

  const labels = await getLabels({
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
    let projectId: string | undefined;
    if (bookingId) {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { projectId: true },
      });
      projectId = booking?.projectId ?? undefined;
    }
    const value = await getConfig(prisma, 'comms.whatsapp_number', projectId ? { projectId } : undefined);
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

  return (
    <main className="min-h-screen bg-surface-background p-24 md:p-32">
      <div className="max-w-4xl mx-auto">
        {/* Cover image */}
        {service.coverUrl && (
          <div className="mb-24 rounded-lg overflow-hidden bg-surface-paper">
            <Image
              src={`/api/uploads/${service.coverUrl}`}
              alt={service.title}
              width={640}
              height={384}
              priority
              className="w-full h-64 md:h-96 object-cover"
            />
          </div>
        )}

        {/* Title & provider */}
        <div className="mb-24">
          <h1 className="text-heading-1 font-bold text-text-ink mb-8">{service.title}</h1>
          <div className="flex items-center gap-8 text-body text-text-secondary mb-16">
            <span>
              {labels['services.detail.by_provider'].replace('{provider}', service.provider.name)}
            </span>
            {service.provider.vetted && (
              <span className="inline-flex items-center gap-4 px-8 py-4 bg-status-good bg-opacity-10 text-status-good rounded-full text-small font-semibold">
                ✓ {labels['services.detail.vetted_badge']}
              </span>
            )}
          </div>
          {service.description && (
            <p className="text-body text-text-secondary">{service.description}</p>
          )}
        </div>

        {/* Key details grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-24 mb-24">
          <div className="bg-surface-paper border border-border-line rounded-lg p-24">
            <p className="text-small text-text-secondary mb-8">{labels['services.detail.price_model']}</p>
            <p className="text-heading-3 font-semibold text-text-ink">
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
            <div className="bg-surface-paper border border-border-line rounded-lg p-24">
              <p className="text-small text-text-secondary mb-8">{labels['services.detail.duration']}</p>
              <p className="text-heading-3 font-semibold text-text-ink">
                {labels['services.detail.duration_hours'].replace('{minutes}', String(service.durationMin))}
              </p>
            </div>
          )}

          <div className="bg-surface-paper border border-border-line rounded-lg p-24">
            <p className="text-small text-text-secondary mb-8">
              {labels['services.detail.advance_notice']}
            </p>
            <p className="text-heading-3 font-semibold text-text-ink">
              {service.advanceNoticeHours > 0
                ? labels['services.detail.advance_notice_hours'].replace('{hours}', String(service.advanceNoticeHours))
                : labels['services.detail.advance_notice_none']}
            </p>
          </div>
        </div>

        {/* Provider details */}
        {service.provider.description && (
          <div className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24">
            <h2 className="text-heading-2 font-semibold text-text-ink mb-12">
              {labels['services.detail.about_provider']}
            </h2>
            <p className="text-body text-text-secondary">{service.provider.description}</p>
          </div>
        )}

        {/* Gallery */}
        {service.mediaUrls.length > 0 && (
          <div className="mb-24">
            <h2 className="text-heading-2 font-semibold text-text-ink mb-12">{labels['services.detail.photos']}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-12 rounded-lg overflow-hidden">
              {service.mediaUrls.map((url, idx) => (
                <Image
                  key={idx}
                  src={`/api/uploads/${url}`}
                  alt={`${service.title} ${idx + 1}`}
                  width={320}
                  height={160}
                  className="w-full h-40 object-cover rounded-lg"
                />
              ))}
            </div>
          </div>
        )}

        {/* SA-2: the ordering surface — refine → place → pay → confirm */}
        <div className="mt-32">
          <OrderWizard
            service={{
              id: service.id,
              title: service.title,
              priceModel: service.priceModel,
              basePriceThb: service.basePriceThb,
            }}
            bookingId={bookingId}
            whatsappNumber={whatsappNumber}
            labels={labels}
          />
          <div className="mt-16">
            <Link
              href={bookingId ? `/services?bookingId=${bookingId}` : '/services'}
              className="text-small font-semibold text-brand-andaman hover:underline"
            >
              ← {labels['services.detail.back']}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
