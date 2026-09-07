'use client';

import { useCallback, useRef, useState } from 'react';
import Image from 'next/image';
import { Button } from './Button';

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
}: {
  images: string[];
  alt: string;
  showAllLabel: string;
}) {
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
      <div className="aspect-[4/3] bg-gradient-to-br from-brand-andaman to-brand-deep rounded-lg" />
    );
  }

  return (
    <div>
      {/* Desktop: the five-up mosaic. */}
      <div className="hidden md:grid grid-cols-4 grid-rows-2 gap-8">
        <div className="col-span-2 row-span-2 relative aspect-[4/3] overflow-hidden rounded-l-lg">
          <Image src={cover} alt={alt} fill className="object-cover" priority />
        </div>
        {thumbs.map((src, index) => (
          <div
            key={src}
            className={`relative aspect-[4/3] overflow-hidden ${
              index === 1 ? 'rounded-tr-lg' : ''
            } ${index === 3 ? 'rounded-br-lg' : ''}`}
          >
            <Image src={src} alt={alt} fill className="object-cover" />
          </div>
        ))}
      </div>

      {/* Mobile: every photo, swipeable. */}
      <div className="md:hidden">
        <div
          ref={trackRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth rounded-lg
                     [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          aria-label={alt}
        >
          {images.map((src, index) => (
            <div
              key={src}
              className="relative shrink-0 w-full aspect-[4/3] snap-center overflow-hidden"
            >
              <Image
                src={src}
                alt={`${alt} (${index + 1}/${images.length})`}
                fill
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
              className="px-12 py-6 rounded-full bg-[rgba(22,33,31,0.6)] text-surface-ivory text-small"
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
          >
            {showAllLabel}
          </Button>
        </div>
      )}
      {expanded && rest.length > 0 && (
        <div className="mt-12 hidden md:grid grid-cols-2 md:grid-cols-4 gap-8">
          {rest.map((src, index) => (
            <div key={src} className="relative aspect-[4/3] overflow-hidden rounded-sm">
              <Image
                src={src}
                alt={`${alt} (${index + 6}/${images.length})`}
                fill
                className="object-cover"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
