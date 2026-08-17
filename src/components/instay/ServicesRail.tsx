'use client';

import React from 'react';
import { Badge } from '@/components/Badge';

export interface RailService {
  id: string;
  title: string;
  categoryKey: string;
  basePriceThb: number | null;
  priceModel: string;
  providerName: string;
  isVetted: boolean;
}

interface ServicesRailProps {
  services: RailService[];
  labels: Record<string, string>;
  /** Where a card leads — the marketplace, scoped to this stay. */
  hrefForService: (serviceId: string) => string;
}

/**
 * The S6 services rail: what this stay's project can actually deliver, laid
 * out as a horizontal scroll of cards. The list arrives already scoped to the
 * project, so the rail never advertises something the guest cannot order.
 */
export const ServicesRail = React.forwardRef<HTMLDivElement, ServicesRailProps>(
  ({ services, labels, hrefForService }, ref) => {
    if (services.length === 0) {
      return null;
    }

    return (
      <section ref={ref} className="mb-40">
        <h2 className="text-heading-2 font-semibold text-text-ink mb-16">
          {labels['home.services.title']}
        </h2>

        <div
          className="flex gap-16 overflow-x-auto pb-12 -mx-24 px-24 snap-x"
          // A rail is a list of links; the scroller itself is what gets focus
          // when a keyboard user tabs past the heading.
          tabIndex={0}
          aria-label={labels['home.services.title']}
        >
          {services.map((service) => (
            <a
              key={service.id}
              href={hrefForService(service.id)}
              className="snap-start shrink-0 w-60 bg-surface-paper border border-border-line rounded-md p-16 hover:border-brand-andaman transition"
            >
              <div className="flex items-start justify-between gap-8 mb-8">
                <p className="text-body font-semibold text-text-ink">{service.title}</p>
                {service.isVetted ? (
                  <Badge variant="verified">{labels['home.services.vetted']}</Badge>
                ) : null}
              </div>

              <p className="text-small text-text-secondary mb-12">{service.providerName}</p>

              {service.basePriceThb !== null ? (
                <p className="text-small text-text-ink tabular-nums">
                  {labels['home.services.from']} ฿{service.basePriceThb.toLocaleString('en-US')}
                </p>
              ) : null}
            </a>
          ))}
        </div>
      </section>
    );
  }
);

ServicesRail.displayName = 'ServicesRail';
