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
      <section ref={ref} className="mb-24">
        <p className="font-display text-kicker uppercase text-brand-sun m-0 mb-12">
          {labels['home.services.title']}
        </p>

        <div
          className="flex gap-16 overflow-x-auto pb-12 snap-x lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0"
          tabIndex={0}
          aria-label={labels['home.services.title']}
        >
          {services.map((service) => (
            <a
              key={service.id}
              href={hrefForService(service.id)}
              className="snap-start shrink-0 w-60 lg:w-auto bg-surface-paper border border-border-line rounded-lg overflow-hidden hover:border-brand-andaman transition"
            >
              <div className="h-80 bg-gradient-to-br from-brand-andaman to-brand-deep" />
              <div className="p-12">
                <div className="flex items-start justify-between gap-8 mb-4">
                  <p className="text-body font-semibold text-text-ink m-0">{service.title}</p>
                  {service.isVetted ? (
                    <Badge variant="verified">{labels['home.services.vetted']}</Badge>
                  ) : null}
                </div>
                {service.providerName ? (
                  <p className="text-small text-text-stone m-0 mb-8">{service.providerName}</p>
                ) : null}
                {service.basePriceThb !== null ? (
                  <p className="text-small text-text-stone tabular-nums m-0">
                    {/* basePriceThb is satang (THB × 100) straight from the DB
                        via getInStayHomeSpace — convert to baht only here, at
                        final render (money rule, CLAUDE.md "Money rules"). */}
                    {labels['home.services.from']} ฿{(service.basePriceThb / 100).toLocaleString('en-US')}
                  </p>
                ) : null}
              </div>
            </a>
          ))}
        </div>
      </section>
    );
  }
);

ServicesRail.displayName = 'ServicesRail';
