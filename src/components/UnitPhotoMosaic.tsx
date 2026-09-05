'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from './Button';

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
  const cover = images[0];
  const thumbs = images.slice(1, 5);
  const rest = images.slice(5);

  if (!cover) {
    return (
      <div className="aspect-[4/3] bg-gradient-to-br from-brand-andaman to-brand-deep rounded-lg" />
    );
  }

  return (
    <div>
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
      <div className="md:hidden relative aspect-[4/3] overflow-hidden rounded-lg">
        <Image src={cover} alt={alt} fill className="object-cover" priority />
        {images.length > 1 && (
          <span className="absolute bottom-16 right-16 px-12 py-6 rounded-full bg-[rgba(22,33,31,0.6)] text-surface-ivory text-small">
            1 / {images.length}
          </span>
        )}
      </div>
      {rest.length > 0 && (
        <div className="mt-12 flex justify-end">
          <Button variant="secondary" size="sm" onClick={() => setExpanded((open) => !open)}>
            {showAllLabel}
          </Button>
        </div>
      )}
      {expanded && rest.length > 0 && (
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          {rest.map((src) => (
            <div key={src} className="relative aspect-[4/3] overflow-hidden rounded-sm">
              <Image src={src} alt={alt} fill className="object-cover" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
