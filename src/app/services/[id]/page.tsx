import { notFound } from 'next/navigation';
import { getLabels } from '@/lib/i18n';

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

export default async function ServiceDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;

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
  });

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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/uploads/${service.coverUrl}`}
              alt={service.title}
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
                {service.priceModel === 'fixed'
                  ? `฿${service.basePriceThb.toLocaleString()}`
                  : `from ฿${service.basePriceThb.toLocaleString()}`}
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
            <h2 className="text-heading-2 font-semibold text-text-ink mb-12">Photos</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-12 rounded-lg overflow-hidden">
              {service.mediaUrls.map((url, idx) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={idx}
                  src={`/api/uploads/${url}`}
                  alt={`${service.title} ${idx + 1}`}
                  className="w-full h-40 object-cover rounded-lg"
                />
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-32 flex gap-12">
          <button
            onClick={() => window.history.back()}
            className="px-24 py-12 border border-border-line rounded-lg text-body font-semibold text-text-ink hover:bg-surface-paper transition-colors"
          >
            Go back
          </button>
          <button
            className="flex-1 px-24 py-12 bg-brand-deep text-on-dark-text rounded-lg text-body font-semibold hover:opacity-90 transition-opacity"
          >
            {labels['services.detail.order']}
          </button>
        </div>
      </div>
    </main>
  );
}
