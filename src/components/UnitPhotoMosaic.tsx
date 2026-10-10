'use client';

import { useCallback, useId, useRef, useState } from 'react';
import Image from 'next/image';
import { Button } from './Button';

const MOBILE_IMAGE_SIZES = '(max-width: 768px) 100vw, 300px';

/**
 * Unit photography: a mosaic on desktop, a swipeable carousel on mobile.
 *
 * The mobile half used to render the cover image alone, with a "1 / N" badge
 * that looked like a carousel position and was purely decorative. The only way
 * to see another photo was a "show all" button that appeared solely when there
 * were MORE than five images — so for any unit with two to five photos, a
 * mobile guest could not see any picture but the first. On a booking funnel
 * whose traffic is mostly phones, that is most of the photography, invisible.
 *
 * Now it is a real carousel: CSS scroll-snap, which is native, touch-driven,
 * keyboard-reachable and needs no library. The counter reads the actual
 * scroll position rather than asserting one.
 */
export function UnitPhotoMosaic({
  images,
  alt,
  showAllLabel,
  emptyLabel,
}: {
  images: string[];
  alt: string;
  showAllLabel: string;
  /** Shown when the home has no published photos yet (doc 06: every
   *  component ships its empty state, never a blank block). */
  emptyLabel?: string;
}) {
  const overflowId = useId();
  const [expanded, setExpanded] = useState(false);
  const [current, setCurrent] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const cover = images[0];
  const thumbs = images.slice(1, 5);
  const rest = images.slice(5);

  // Which slide is showing, derived from where the track actually is. Reading
  // the scroll position keeps the counter honest when the guest flicks past
  // several photos at once.
  const handleScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const width = track.clientWidth;
    if (width === 0) return;
    const index = Math.round(track.scrollLeft / width);
    setCurrent(Math.min(Math.max(index, 0), images.length - 1));
  }, [images.length]);

  if (!cover) {
    return (
      <div
        role="img"
        aria-label={emptyLabel || alt}
        className="flex aspect-[4/3] flex-col items-center justify-center gap-12 rounded-lg bg-gradient-to-br from-brand-andaman to-brand-deep p-24 text-center text-surface-ivory"
      >
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M4 7h3l2-2h6l2 2h3v12H4z" strokeLinejoin="round" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
        {emptyLabel ? <p className="max-w-xs text-small text-surface-ivory/80">{emptyLabel}</p> : null}
      </div>
    );
  }

  return (
    <div>
      {/* The same image-led composition serves project and unit pages. Sparse
          galleries fill the available width instead of leaving empty cells. */}
      <div className={`hidden overflow-hidden rounded-lg md:grid gap-8 ${images.length === 1 ? 'grid-cols-1' : images.length === 2 ? 'grid-cols-2' : 'grid-cols-4 grid-rows-2'}`}>
        <div className={`relative overflow-hidden bg-surface-sand ${images.length === 1 ? 'aspect-[16/7]' : images.length === 2 ? 'aspect-[4/3]' : 'col-span-2 row-span-2 min-h-[320px] lg:min-h-[400px]'}`}>
          <Image src={cover} alt={alt} fill sizes={images.length === 1 ? '(max-width: 1280px) 100vw, 1200px' : '(max-width: 1280px) 50vw, 600px'} className="object-cover" priority />
        </div>
        {thumbs.map((src, index) => (
          <div
            key={`${src}-${index}`}
            className={`relative overflow-hidden bg-surface-sand ${images.length === 2 ? 'aspect-[4/3]' : images.length === 3 ? 'col-span-2' : images.length === 4 && index === 0 ? 'col-span-2' : ''}`}
          >
            <Image src={src} alt={alt} fill sizes={images.length < 4 || (images.length === 4 && index === 0) ? '(max-width: 1280px) 50vw, 600px' : '(max-width: 1280px) 25vw, 300px'} className="object-cover" />
          </div>
        ))}
      </div>

      {/* Mobile: every photo, swipeable. */}
      <div className="md:hidden">
        <div
          ref={trackRef}
          tabIndex={0}
          role="region"
          onScroll={handleScroll}
          className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-andaman focus-visible:ring-offset-2
                     [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          aria-label={alt}
        >
          {images.map((src, index) => (
            <div
              key={`${src}-${index}`}
              className="relative shrink-0 w-full aspect-[4/3] snap-center overflow-hidden"
            >
              <Image
                src={src}
                alt={`${alt} (${index + 1}/${images.length})`}
                fill
                sizes={MOBILE_IMAGE_SIZES}
                className="object-cover"
                priority={index === 0}
              />
            </div>
          ))}
        </div>

        {images.length > 1 && (
          <div className="relative -mt-40 flex justify-end pr-16">
            {/* aria-live so the position is spoken as the guest swipes, rather
                than being a number only a sighted guest benefits from. */}
            <span
              aria-live="polite"
              className="px-12 py-4 rounded-full bg-brand-deep/70 backdrop-blur-sm text-surface-ivory text-small"
            >
              {current + 1} / {images.length}
            </span>
          </div>
        )}
      </div>

      {/* The overflow grid is a desktop affordance: the mobile carousel already
          carries every photo, so offering "show all" there would reveal nothing
          new. */}
      {rest.length > 0 && (
        <div className="mt-12 hidden md:flex justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
            aria-controls={overflowId}
          >
            {showAllLabel}
          </Button>
        </div>
      )}
      {expanded && rest.length > 0 && (
        <div id={overflowId} className="mt-12 hidden md:grid grid-cols-2 md:grid-cols-4 gap-8">
          {rest.map((src, index) => (
            <div key={src} className="relative aspect-[4/3] overflow-hidden rounded-md">
              <Image
                src={src}
                alt={`${alt} (${index + 6}/${images.length})`}
                fill
                sizes={MOBILE_IMAGE_SIZES}
                className="object-cover"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
