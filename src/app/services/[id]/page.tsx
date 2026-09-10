import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Breadcrumb } from '@/components/Breadcrumb';
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
  searchParams: { bookingId?: string; projectId?: string; unitId?: string };
}) {
  const { id } = params;
  const bookingId = searchParams.bookingId || null;
  const projectId = searchParams.projectId || null;
  const unitId = searchParams.unitId || null;

  let service: ServiceDetail | null = null;
  try {
    const res = await fetch(`/api/services/${id}`, { cache: 'no-store' });
    if (res.ok) service = await res.json();
  } catch {
    // Service fetch failed.
  }
  if (!service) notFound();

  const labels = await getLabels({
    'services.breadcrumb_home': 'Home',
    'services.breadcrumb_services': 'Services',
    'services.breadcrumb_detail': 'Service Details',
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
    'services.detail.photos': 'Photos',
    'services.detail.back': 'Back to services',
    'services.wizard.title': 'Your order',
    'services.wizard.when': 'When',
    'services.wizard.when_required': 'Choose the date and time.',
    'services.wizard.quantity': 'Quantity',
    'services.wizard.passengers': 'Passengers',
    'services.wizard.guests': 'Guests',
    'services.wizard.rooms': 'Rooms',
    'services.wizard.days': 'Days',
    'services.wizard.hours': 'Hours',
    'services.wizard.people': 'People',
    'services.wizard.luggage': 'Luggage',
    'services.wizard.vehicles': 'Vehicles',
    'services.wizard.area': 'Phuket area',
    'services.wizard.address': 'Address / hotel / villa',
    'services.wizard.location_required': 'Enter a Phuket area or service address.',
    'services.wizard.note': 'Note to provider (optional)',
    'services.wizard.total_preview': 'Estimated total',
    'services.wizard.place': 'Order — ฿{total}',
    'services.wizard.place_no_total': 'Place order',
    'services.wizard.pay_title': 'Order placed — choose how to pay',
    'services.wizard.pay_subtitle': 'Pay now by card, or in cash when the service is delivered.',
    'services.wizard.pay_card': 'Pay by card',
    'services.wizard.pay_cash': 'Cash on fulfilment',
    'services.wizard.quote_title': 'Request a tailored quote',
    'services.wizard.request_quote': 'Request quote',
    'services.wizard.quote_requested': 'Quote request sent',
    'services.wizard.quote_requested_body': 'The provider will prepare a price for the details you submitted. You can continue from My myUNO when the quote is ready.',
    'services.wizard.error_generic': 'Could not complete this request. Please try again.',
  });

  let whatsappNumber: string | null = null;
  try {
    let scopedProjectId: string | undefined;
    if (bookingId) {
      const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { projectId: true } });
      scopedProjectId = booking?.projectId ?? undefined;
    } else if (projectId) {
      scopedProjectId = projectId;
    }
    const value = await getConfig(prisma, 'comms.whatsapp_number', scopedProjectId ? { projectId: scopedProjectId } : undefined);
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
    <main className="min-h-screen bg-surface-ivory">
      <Breadcrumb items={[
        { label: labels['services.breadcrumb_home'], href: '/' },
        { label: labels['services.breadcrumb_services'], href: '/services' },
        { label: labels['services.breadcrumb_detail'], current: true },
      ]} />
      <div className="p-24 md:p-32">
        <div className="max-w-4xl mx-auto">
          {service.coverUrl && (
            <div className="mb-24 rounded-lg overflow-hidden bg-surface-paper">
              <Image src={`/api/uploads/${service.coverUrl}`} alt={service.title} width={640} height={384} priority className="w-full h-64 md:h-96 object-cover" />
            </div>
          )}

          <div className="mb-24">
            <h1 className="font-display text-display-xl font-semibold text-text-ink mb-8">{service.title}</h1>
            <div className="flex items-center gap-8 text-body text-text-secondary mb-16">
              <span>{labels['services.detail.by_provider'].replace('{provider}', service.provider.name)}</span>
              {service.provider.vetted && (
                <span className="inline-flex items-center gap-4 px-8 py-4 bg-status-good bg-opacity-10 text-status-good rounded-full text-small font-semibold">
                  ✓ {labels['services.detail.vetted_badge']}
                </span>
              )}
            </div>
            {service.description && <p className="text-body text-text-secondary">{service.description}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-24 mb-24">
            <div className="bg-surface-paper border border-border-line rounded-lg p-24">
              <p className="text-small text-text-secondary mb-8">{labels['services.detail.price_model']}</p>
              <p className="text-heading-3 font-semibold text-text-ink">{priceModelLabel[service.priceModel] || service.priceModel}</p>
              {service.basePriceThb !== null && <p className="text-body text-text-secondary mt-4">{formatServicePriceLabel(service.priceModel, service.basePriceThb)}</p>}
            </div>
            {service.durationMin !== null && (
              <div className="bg-surface-paper border border-border-line rounded-lg p-24">
                <p className="text-small text-text-secondary mb-8">{labels['services.detail.duration']}</p>
                <p className="text-heading-3 font-semibold text-text-ink">{labels['services.detail.duration_hours'].replace('{minutes}', String(service.durationMin))}</p>
              </div>
            )}
            <div className="bg-surface-paper border border-border-line rounded-lg p-24">
              <p className="text-small text-text-secondary mb-8">{labels['services.detail.advance_notice']}</p>
              <p className="text-heading-3 font-semibold text-text-ink">
                {service.advanceNoticeHours > 0
                  ? labels['services.detail.advance_notice_hours'].replace('{hours}', String(service.advanceNoticeHours))
                  : labels['services.detail.advance_notice_none']}
              </p>
            </div>
          </div>

          {service.provider.description && (
            <div className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24">
              <h2 className="text-heading-2 font-semibold text-text-ink mb-12">{labels['services.detail.about_provider']}</h2>
              <p className="text-body text-text-secondary">{service.provider.description}</p>
            </div>
          )}

          {service.mediaUrls.length > 0 && (
            <div className="mb-24">
              <h2 className="text-heading-2 font-semibold text-text-ink mb-12">{labels['services.detail.photos']}</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-12 rounded-lg overflow-hidden">
                {service.mediaUrls.map((url, idx) => (
                  <Image key={url} src={`/api/uploads/${url}`} alt={`${service.title} ${idx + 1}`} width={320} height={160} className="w-full h-40 object-cover rounded-lg" />
                ))}
              </div>
            </div>
          )}

          <div className="mt-32">
            <OrderWizard
              service={{
                id: service.id,
                title: service.title,
                categoryKey: service.categoryKey,
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
              <Link href={bookingId ? `/services?bookingId=${bookingId}` : '/services'} className="text-small font-semibold text-brand-andaman hover:underline">
                ← {labels['services.detail.back']}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
