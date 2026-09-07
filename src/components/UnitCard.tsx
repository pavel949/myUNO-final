'use client';

import React from 'react';
import Image from 'next/image';

export interface UnitCardLabels {
  brandDefault: string;
  onMyUno: string;
  bedroomOne: string;
  bedroomMany: string;
  upToGuests: string;
  perNight: string;
}

const DEFAULT_LABELS: UnitCardLabels = {
  brandDefault: 'Ignatev Estate',
  onMyUno: '· on myUNO',
  bedroomOne: 'bedroom',
  bedroomMany: 'bedrooms',
  upToGuests: 'Up to',
  perNight: '/ night',
};

export interface UnitCardProps {
  id: string;
  name: string;
  projectName: string;
  coverImage?: string;
  bedrooms: number;
  guests: number;
  pricePerNightSatang: number;
  rating?: number;
  verifiedOwner?: boolean;
  labels?: Partial<UnitCardLabels>;
  onSelect?: (id: string) => void;
}

export function UnitCard({
  id,
  name,
  projectName,
  coverImage,
  bedrooms,
  guests,
  pricePerNightSatang,
  rating = 4.9,
  labels,
  onSelect,
}: UnitCardProps) {
  const thbPrice = Math.round(pricePerNightSatang / 100).toLocaleString('en-US');
  const l = { ...DEFAULT_LABELS, ...labels };
  const bedLabel = bedrooms === 1 ? l.bedroomOne : l.bedroomMany;

  return (
    <div
      onClick={() => onSelect?.(id)}
      className="bg-surface-paper border border-border-line rounded-lg overflow-hidden shadow-card hover:shadow-float transition-all duration-micro cursor-pointer group flex flex-col"
    >
      <div className="relative aspect-[4/3] bg-border-line overflow-hidden">
        {coverImage ? (
          <Image
            src={coverImage}
            alt={name}
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
          <p className="text-small text-text-stone mb-4">
            {projectName} <span className="text-text-stone-2">{l.onMyUno}</span>
          </p>
          <h3 className="font-display text-title text-text-ink group-hover:text-brand-andaman transition-colors">
            {name}
          </h3>
          <p className="text-small text-text-stone mt-4">
            {bedrooms} {bedLabel} · {l.upToGuests} {guests}
          </p>
        </div>

        <div className="mt-16 pt-12 border-t border-border-line flex items-center justify-between">
          <div>
            <span className="font-display font-medium text-subtitle text-text-ink tabular-nums">
              ฿{thbPrice}
            </span>
            <span className="text-small text-text-stone"> {l.perNight}</span>
          </div>
          <div className="flex items-center gap-4 text-small font-display font-medium text-text-ink">
            <span className="text-brand-sun">★</span>
            <span>{rating.toFixed(1)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
