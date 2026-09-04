'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MoneyAmount } from './MoneyAmount';

export interface UnitCardProps {
  href: string;
  name: string;
  /** Optional pre-resolved project/location line. */
  subtitle?: string;
  coverUrl?: string | null;
  /** Nightly price in satang. */
  nightlySatang: number;
  /** Pre-resolved "per night" suffix. */
  perNightLabel: string;
  /** Null when nobody has reviewed it — rendered only when known. */
  averageRating?: number | null;
  /** Pre-resolved template with {rating} and {count} already filled. */
  ratingSummary?: string;
  /** Optional pre-resolved badge (e.g. "Instant book"). */
  badge?: string;
  /** Optional save/watch control. When provided, a heart toggle is rendered. */
  save?: {
    saved: boolean;
    onToggle: () => void;
    saveLabel: string;
    savedLabel: string;
  };
}

/**
 * UnitCard — doc 06 §3 / S3. The canonical listing tile used in search results,
 * project pages, and any unit grid. Money via MoneyAmount (satang); all copy
 * pre-resolved by the caller.
 */
export const UnitCard: React.FC<UnitCardProps> = ({
  href,
  name,
  subtitle,
  coverUrl,
  nightlySatang,
  perNightLabel,
  averageRating,
  ratingSummary,
  badge,
  save,
}) => {
  const hasRating =
    averageRating !== null && averageRating !== undefined && Boolean(ratingSummary);

  return (
    <div className="group relative overflow-hidden rounded-lg border border-border-line bg-surface-paper transition-shadow duration-micro hover:shadow-card">
      {save && (
        <button
          type="button"
          onClick={save.onToggle}
          aria-pressed={save.saved}
          aria-label={save.saved ? save.savedLabel : save.saveLabel}
          className="absolute right-12 top-12 z-10 inline-flex h-40 w-40 items-center justify-center rounded-full bg-surface-paper/90 text-text-ink shadow-card transition-colors duration-micro hover:bg-surface-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-andaman"
        >
          <svg
            className={save.saved ? 'text-state-error' : 'text-text-secondary'}
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill={save.saved ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 10-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z" />
          </svg>
        </button>
      )}
      <Link href={href} className="block">
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt={name}
            width={640}
            height={360}
            className="aspect-video w-full object-cover"
          />
        ) : (
          <div className="aspect-video w-full bg-gradient-to-br from-brand-andaman to-brand-andaman-dark" />
        )}
        <div className="p-16">
          {badge && (
            <span className="mb-8 inline-block rounded-full bg-brand-sun-soft px-8 py-2 text-small font-medium text-brand-deep">
              {badge}
            </span>
          )}
          <h3 className="mb-4 text-subtitle font-semibold text-text-ink">{name}</h3>
          {subtitle && <p className="mb-8 text-small text-text-secondary">{subtitle}</p>}
          <p className="text-title font-bold text-brand-andaman">
            <MoneyAmount satang={nightlySatang} />{' '}
            <span className="text-small font-normal text-text-secondary">{perNightLabel}</span>
          </p>
          {hasRating && <p className="mt-8 text-small text-text-secondary">{ratingSummary}</p>}
        </div>
      </Link>
    </div>
  );
};

UnitCard.displayName = 'UnitCard';
