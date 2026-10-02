import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { TrustMark } from '@/components/TrustMark';
import { servicePresentationImage } from '@/lib/presentation-media';

export interface ServiceCardData {
  id: string;
  title: string;
  description: string | null;
  providerName: string | null;
  providerVetted: boolean;
  basePriceThb: number | null;
  coverUrl: string | null;
}

export interface ServiceCardLabels {
  vetted: string;
  from: string;
  noPhoto: string;
}

export function ServiceCard({
  service,
  labels,
  href,
  children,
}: {
  service: ServiceCardData;
  labels: ServiceCardLabels;
  href?: string;
  children?: ReactNode;
}) {
  const image = servicePresentationImage(service.id, service.coverUrl);
  const content = (
    <>
      <div className="relative aspect-[4/3] overflow-hidden bg-brand-deep">
        <Image
          src={image.src}
          alt={image.illustrative ? '' : service.title}
          fill
          sizes={['(max-width: 640px) 100vw', '(max-width: 1024px) 50vw', '33vw'].join(', ')}
          className="object-cover transition duration-500 group-hover:scale-[1.03]"
        />
        {image.illustrative ? (
          <span className="absolute right-12 top-12 z-10 rounded-full bg-black/35 px-12 py-4 text-small text-white/80 backdrop-blur">
            {labels.noPhoto}
          </span>
        ) : null}
      </div>
      <div className="p-20">
        <div className="flex min-w-0 flex-col items-start gap-8 lg:flex-row lg:flex-wrap lg:justify-between">
          <h3 className="min-w-0 break-words font-display text-title text-text-ink">{service.title}</h3>
          {service.providerVetted ? (
            <span className="inline-flex max-w-full flex-wrap items-center gap-4 text-small font-semibold text-state-success"><TrustMark size={14} filled />{labels.vetted}</span>
          ) : null}
        </div>
        {service.providerName ? <p className="mt-4 text-small text-text-secondary">{service.providerName}</p> : null}
        {service.description ? <p className="mt-12 line-clamp-2 text-small text-text-secondary">{service.description}</p> : null}
        {service.basePriceThb !== null ? (
          <p className="mt-16 text-body font-semibold text-brand-andaman">
            {labels.from} ฿{Math.round(service.basePriceThb / 100).toLocaleString()}
          </p>
        ) : null}
        {children}
      </div>
    </>
  );

  return href ? (
    <Link href={href} className="group block h-full min-w-0 overflow-hidden rounded-2xl border border-border-line bg-surface-paper transition hover:shadow-card">
      {content}
    </Link>
  ) : (
    <article className="group overflow-hidden rounded-2xl border border-border-line bg-surface-paper">
      {content}
    </article>
  );
}
