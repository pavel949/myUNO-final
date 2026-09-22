import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { TrustMark } from '@/components/TrustMark';

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
  const content = (
    <>
      <div className="relative aspect-[4/3] overflow-hidden bg-brand-deep">
        {service.coverUrl ? (
          <Image
            src={service.coverUrl}
            alt={service.title}
            fill
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-brand-andaman via-brand-deep to-brand-andaman-dark">
            <span className="absolute right-16 top-16 rounded-full border border-white/20 px-12 py-8 text-small text-white/60">
              {labels.noPhoto}
            </span>
          </div>
        )}
      </div>
      <div className="p-20">
        <div className="flex items-start justify-between gap-12">
          <h3 className="font-display text-title text-text-ink">{service.title}</h3>
          {service.providerVetted ? (
            <span className="shrink-0 inline-flex items-center gap-4 text-small font-semibold text-state-success"><TrustMark size={14} filled />{labels.vetted}</span>
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
    <Link href={href} className="group block overflow-hidden rounded-2xl border border-border-line bg-surface-paper transition hover:shadow-card">
      {content}
    </Link>
  ) : (
    <article className="group overflow-hidden rounded-2xl border border-border-line bg-surface-paper">
      {content}
    </article>
  );
}
