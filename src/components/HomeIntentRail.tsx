'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';

const HOME_RAIL_IMAGE_SIZES = '(max-width: 768px) 280px, (max-width: 1024px) 50vw, 25vw';

export type HomeRailIntent = 'stay' | 'monthly' | 'buy';

export interface HomeRailItem {
  key: string;
  intent: HomeRailIntent;
  name: string;
  projectName: string;
  href: string;
  imageSrc: string | null;
  bedrooms: number;
  bathrooms: number;
  sizeSqm?: number | null;
  guests?: number | null;
  priceLabel: string;
}

interface HomeIntentRailProps {
  items: HomeRailItem[];
  labels: {
    stay: string;
    monthly: string;
    buy: string;
    bedrooms: string;
    bathrooms: string;
    sqm: string;
    guests: string;
    open: string;
    empty: string;
  };
}

export function HomeIntentRail({ items, labels }: HomeIntentRailProps) {
  const available = useMemo(
    () => (['stay', 'monthly', 'buy'] as HomeRailIntent[]).filter((intent) =>
      items.some((item) => item.intent === intent)
    ),
    [items]
  );
  const [active, setActive] = useState<HomeRailIntent>(available[0] ?? 'stay');
  const visible = items.filter((item) => item.intent === active).slice(0, 4);

  if (!items.length) return null;

  const tabLabel = {
    stay: labels.stay,
    monthly: labels.monthly,
    buy: labels.buy,
  };

  return (
    <div>
      <div className="mb-24 flex flex-wrap gap-8" role="tablist" aria-label="Home intent">
        {available.map((intent) => (
          <button
            key={intent}
            type="button"
            role="tab"
            aria-selected={active === intent}
            onClick={() => setActive(intent)}
            className={`min-h-44 rounded-full px-16 text-small font-semibold transition-colors duration-micro ${
              active === intent
                ? 'bg-brand-andaman text-white'
                : 'border border-border-line bg-surface-paper text-text-secondary hover:text-text-ink'
            }`}
          >
            {tabLabel[intent]}
          </button>
        ))}
      </div>

      {visible.length ? (
        <div className="-mx-20 flex snap-x gap-16 overflow-x-auto px-20 pb-8 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-4">
          {visible.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="group w-[280px] shrink-0 snap-start overflow-hidden rounded-lg border border-border-line bg-surface-paper transition-shadow duration-structural hover:shadow-card md:w-auto"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-brand-deep">
                {item.imageSrc ? (
                  <Image
                    src={item.imageSrc}
                    alt={item.name}
                    fill
                    sizes={HOME_RAIL_IMAGE_SIZES}
                    className="object-cover transition-transform duration-structural group-hover:scale-[1.02]"
                  />
                ) : null}
              </div>
              <div className="p-20">
                <p className="text-small font-semibold text-brand-andaman">{item.projectName}</p>
                <h3 className="mt-4 font-display text-title font-semibold text-text-ink">{item.name}</h3>
                <p className="mt-8 text-small text-text-secondary">
                  {item.bedrooms} {labels.bedrooms} · {item.bathrooms} {labels.bathrooms}
                  {item.sizeSqm ? ` · ${item.sizeSqm} ${labels.sqm}` : ''}
                  {item.guests ? ` · ${labels.guests.replace('{count}', String(item.guests))}` : ''}
                </p>
                <div className="mt-16 flex items-end justify-between gap-12">
                  <p className="font-display text-body-strong tabular-nums text-text-ink">{item.priceLabel}</p>
                  <span className="shrink-0 text-small font-semibold text-brand-andaman">{labels.open} →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border-line bg-surface-paper p-24 text-small text-text-secondary">
          {labels.empty}
        </div>
      )}
    </div>
  );
}
