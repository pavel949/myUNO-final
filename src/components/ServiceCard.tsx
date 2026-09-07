'use client';

import React from 'react';
import Image from 'next/image';

export interface ServiceCardLabels {
  brandDefault: string;
  vetted: string;
  from: string;
  minUnit: string;
}

const DEFAULT_LABELS: ServiceCardLabels = {
  brandDefault: 'Serviced Living',
  vetted: 'Vetted',
  from: 'From',
  minUnit: 'min',
};

export interface ServiceCardProps {
  id: string;
  title: string;
  providerName: string;
  categoryIconName?: string;
  coverImage?: string;
  priceFromSatang: number;
  durationMinutes?: number;
  verifiedProvider?: boolean;
  labels?: Partial<ServiceCardLabels>;
  onSelect?: (id: string) => void;
}

export function ServiceCard({
  id,
  title,
  providerName,
  coverImage,
  priceFromSatang,
  durationMinutes,
  verifiedProvider = true,
  labels,
  onSelect,
}: ServiceCardProps) {
  const thbPrice = Math.round(priceFromSatang / 100).toLocaleString('en-US');
  const l = { ...DEFAULT_LABELS, ...labels };

  return (
    <div
      onClick={() => onSelect?.(id)}
      className="bg-surface-paper border border-border-line rounded-lg overflow-hidden shadow-card hover:shadow-float transition-all duration-micro cursor-pointer group flex flex-col"
    >
      <div className="relative aspect-[16/9] bg-border-line overflow-hidden">
        {coverImage ? (
          <Image
            src={coverImage}
            alt={title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-structural"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-stone bg-surface-ivory">
            <span className="font-display text-small uppercase tracking-wider text-brand-sun">
              {l.brandDefault}
            </span>
          </div>
        )}
      </div>

      <div className="p-16 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-8 mb-4">
            <span className="text-small text-text-stone">{providerName}</span>
            {verifiedProvider && (
              <span className="inline-flex items-center text-[11px] font-display font-medium text-state-success bg-state-success-soft px-6 py-2 rounded-full">
                {l.vetted}
              </span>
            )}
          </div>
          <h3 className="font-display text-subtitle text-text-ink group-hover:text-brand-andaman transition-colors">
            {title}
          </h3>
        </div>

        <div className="mt-16 pt-12 border-t border-border-line flex items-center justify-between">
          <div>
            <span className="text-small text-text-stone">{l.from} </span>
            <span className="font-display font-medium text-subtitle text-text-ink tabular-nums">
              ฿{thbPrice}
            </span>
          </div>
          {durationMinutes && (
            <span className="text-small text-text-stone bg-surface-ivory px-8 py-2 rounded-sm border border-border-line">
              {durationMinutes} {l.minUnit}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
