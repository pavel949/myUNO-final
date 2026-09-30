import Image from 'next/image';
import Link from 'next/link';
import type { PublicMarketplaceService } from '@/modules/services';

type Labels = Record<string, string>;
const baht = (satang: number) => (satang / 100).toLocaleString();

export default function ProjectServiceMarketplace({
  projectId,
  projectName,
  services,
  labels,
}: {
  projectId: string;
  projectName: string;
  services: PublicMarketplaceService[];
  labels: Labels;
}) {
  if (!services.length) return null;
  const categories = [...new Set(services.map(service => service.categoryKey))];
  return (
    <section className="bg-surface-ivory px-24 py-48 md:py-64" id="services">
      <div className="mx-auto max-w-6xl">
        <p className="text-kicker font-semibold uppercase text-brand-andaman">
          {labels['project.services.eyebrow']}
        </p>
        <div className="mt-8 flex flex-wrap items-end justify-between gap-16">
          <div>
            <h2 className="font-display text-display-xl font-semibold text-text-ink">
              {labels['project.services.title']}
            </h2>
            <p className="mt-8 max-w-3xl text-body text-text-secondary">
              {labels['project.services.body'].replace('{project}', projectName)}
            </p>
          </div>
          <Link
            href={`/services?projectId=${encodeURIComponent(projectId)}`}
            className="font-semibold text-brand-andaman hover:underline"
          >
            {labels['project.services.view_all']}
          </Link>
        </div>

        <div className="mt-20 flex flex-wrap gap-8">
          {categories.slice(0, 10).map(category => (
            <Link
              key={category}
              href={`/services?projectId=${encodeURIComponent(projectId)}&category=${encodeURIComponent(category)}`}
              className="rounded-full border border-border-line bg-surface-paper px-12 py-8 text-small text-text-ink hover:border-brand-andaman"
            >
              {labels[`services.category.${category}`] || category.replace(/_/g, ' ')}
            </Link>
          ))}
        </div>

        <div className="mt-24 grid gap-16 sm:grid-cols-2 lg:grid-cols-4">
          {services.slice(0, 8).map(service => (
            <Link
              key={service.id}
              href={`/services/${service.id}?projectId=${encodeURIComponent(projectId)}`}
              className="overflow-hidden rounded-xl border border-border-line bg-surface-paper transition hover:shadow-card"
            >
              {service.coverUrl ? (
                <Image
                  src={service.coverUrl}
                  alt={service.title}
                  width={640}
                  height={360}
                  className="aspect-video w-full object-cover"
                />
              ) : (
                <div className="aspect-video bg-surface-muted" />
              )}
              <div className="p-16">
                <p className="text-small text-brand-andaman">
                  {labels[`services.category.${service.categoryKey}`] || service.categoryKey.replace(/_/g, ' ')}
                </p>
                <h3 className="mt-4 font-semibold text-text-ink">{service.title}</h3>
                {service.providerName && (
                  <p className="mt-4 text-small text-text-secondary">{service.providerName}</p>
                )}
                {service.basePriceThb !== null && (
                  <p className="mt-12 font-semibold text-text-ink">
                    {labels['project.services.from'].replace('{price}', baht(service.basePriceThb))}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
