'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { PropertyImage } from '@/components/property/PropertyImage';
import { Button } from './Button';

const FULLSCREEN_IMAGE_SIZES = '100vw';
const MOBILE_IMAGE_SIZES = '(max-width: 768px) 100vw, 300px';

/** Image mosaic and native mobile carousel with an accessible full-screen viewer.
 * Native dialog provides modal focus containment; close restores the trigger.
 */
export function UnitPhotoMosaic({
  images,
  alt,
  showAllLabel,
  emptyLabel,
  galleryLabels,
}: {
  images: string[];
  alt: string;
  showAllLabel: string;
  /** Shown when the home has no published photos yet (doc 06: every
   *  component ships its empty state, never a blank block). */
  emptyLabel?: string;
  galleryLabels?: { close: string; previous: string; next: string; unavailable: string };
}) {
  const overflowId = useId();
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const touchStart = useRef<number | null>(null);
  const galleryOpen = galleryIndex !== null;
  const copy = galleryLabels || { close: 'Close gallery', previous: 'Previous photo', next: 'Next photo', unavailable: 'This photo could not be loaded.' };
  const openGallery = (index: number, trigger: HTMLElement) => {
    triggerRef.current = trigger;
    setGalleryIndex(index);
  };
  const closeGallery = () => setGalleryIndex(null);
  const move = (direction: number) => setGalleryIndex(index => index === null ? index : (index + direction + images.length) % images.length);
  useEffect(() => {
    if (!galleryOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      triggerRef.current?.focus();
    };
  }, [galleryOpen]);
  const [current, setCurrent] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const cover = images[0];
  const thumbs = images.slice(1, 5);


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
        <button type="button" aria-label={`${showAllLabel}: 1 / ${images.length}`} onClick={event => openGallery(0, event.currentTarget)} className={`relative overflow-hidden bg-surface-sand ${images.length === 1 ? 'aspect-[16/7]' : images.length === 2 ? 'aspect-[4/3]' : 'col-span-2 row-span-2 min-h-[320px] lg:min-h-[400px]'}`}>
          <PropertyImage fallbackLabel={emptyLabel || alt} src={cover} alt={alt} fill sizes={images.length === 1 ? '(max-width: 1280px) 100vw, 1200px' : '(max-width: 1280px) 50vw, 600px'} className="object-cover" priority />
        </button>
        {thumbs.map((src, index) => (
          <button type="button" aria-label={`${showAllLabel}: ${index + 2} / ${images.length}`} onClick={event => openGallery(index + 1, event.currentTarget)}
            key={`${src}-${index}`}
            className={`relative overflow-hidden bg-surface-sand ${images.length === 2 ? 'aspect-[4/3]' : images.length === 3 ? 'col-span-2' : images.length === 4 && index === 0 ? 'col-span-2' : ''}`}
          >
            <PropertyImage fallbackLabel={emptyLabel || alt} src={src} alt={alt} fill sizes={images.length < 4 || (images.length === 4 && index === 0) ? '(max-width: 1280px) 50vw, 600px' : '(max-width: 1280px) 25vw, 300px'} className="object-cover" />
          </button>
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
            <button type="button" aria-label={`${showAllLabel}: ${index + 1} / ${images.length}`} onClick={event => openGallery(index, event.currentTarget)}
              key={`${src}-${index}`}
              className="relative shrink-0 w-full aspect-[4/3] snap-center overflow-hidden"
            >
              <PropertyImage fallbackLabel={emptyLabel || alt}
                src={src}
                alt={`${alt} (${index + 1}/${images.length})`}
                fill
                sizes={MOBILE_IMAGE_SIZES}
                className="object-cover"
                priority={index === 0}
              />
            </button>
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

      <div className="mt-12 flex justify-end">
        <Button type="button" variant="secondary" size="sm" onClick={event => openGallery(current, event.currentTarget)} aria-haspopup="dialog" aria-expanded={galleryOpen} aria-controls={overflowId}>
          {showAllLabel}
        </Button>
      </div>
      <dialog ref={dialogRef} id={overflowId} aria-label={`${showAllLabel}: ${alt}`} onCancel={event => { event.preventDefault(); closeGallery(); }}
        onKeyDown={event => {
          if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
          if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
          if (event.key === 'Escape') { event.preventDefault(); closeGallery(); }
        }}
        className="fixed inset-0 m-0 h-[100dvh] max-h-none w-screen max-w-none bg-brand-deep p-16 text-surface-ivory backdrop:bg-black/80 sm:p-24">
        {galleryIndex !== null && <div className="flex h-full flex-col gap-16">
          <div className="flex items-center justify-between gap-16">
            <p className="min-w-0 truncate text-body">{alt}</p>
            <button type="button" autoFocus onClick={closeGallery} className="min-h-44 shrink-0 rounded-md border border-surface-ivory/40 px-16 focus-visible:outline-2 focus-visible:outline-offset-4">{copy.close}</button>
          </div>
          <div className="relative min-h-0 flex-1" onTouchStart={event => { touchStart.current = event.touches[0]?.clientX ?? null; }}
            onTouchEnd={event => {
              const end = event.changedTouches[0]?.clientX;
              if (touchStart.current !== null && end !== undefined && Math.abs(end - touchStart.current) > 50) move(end < touchStart.current ? 1 : -1);
              touchStart.current = null;
            }}>
            <PropertyImage key={`${galleryIndex}-${images[galleryIndex]}`} src={images[galleryIndex]} alt={`${alt} (${galleryIndex + 1}/${images.length})`} fallbackLabel={copy.unavailable} fill sizes={FULLSCREEN_IMAGE_SIZES} className="object-contain" />
          </div>
          <div className="flex items-center justify-between gap-16 pb-[env(safe-area-inset-bottom)]">
            <button type="button" aria-label={copy.previous} disabled={images.length < 2} onClick={() => move(-1)} className="min-h-44 rounded-md border border-surface-ivory/40 px-16 disabled:opacity-40"><span aria-hidden="true">{'←'}</span><span className="ml-8 hidden sm:inline">{copy.previous}</span></button>
            <p role="status" aria-live="polite" className="shrink-0 text-small">{galleryIndex + 1} / {images.length}</p>
            <button type="button" aria-label={copy.next} disabled={images.length < 2} onClick={() => move(1)} className="min-h-44 rounded-md border border-surface-ivory/40 px-16 disabled:opacity-40"><span className="mr-8 hidden sm:inline">{copy.next}</span><span aria-hidden="true">{'→'}</span></button>
          </div>
        </div>}
      </dialog>
    </div>
  );
}
