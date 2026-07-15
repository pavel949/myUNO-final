import { getLabels } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

// S11 marketplace browse lands with the services phase; this page keeps the
// entry point honest (no dead link) until then.
export default async function ServicesPage() {
  const labels = await getLabels({
    'services.browse.title': 'Services',
    'services.browse.coming':
      'The services marketplace is opening soon — cleaning, repairs, deliveries, all vetted. Meanwhile, message us from your trip and we will arrange anything you need.',
  });

  return (
    <main className="min-h-screen bg-surface-background p-24 md:p-32">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-heading-1 font-bold text-text-ink mb-24">
          {labels['services.browse.title']}
        </h1>
        <div className="bg-surface-paper border border-border-line rounded-lg p-32 text-center">
          <p className="text-body text-text-secondary">
            {labels['services.browse.coming']}
          </p>
        </div>
      </div>
    </main>
  );
}
