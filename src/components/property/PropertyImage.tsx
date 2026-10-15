'use client';

import Image, { type ImageProps } from 'next/image';
import { useState } from 'react';

/** Keep the image slot intact when a published photo cannot be delivered. */
export function PropertyImage({ fallbackLabel, ...props }: ImageProps & { fallbackLabel: string }) {
  const [failedSource, setFailedSource] = useState<ImageProps['src'] | null>(null);
  if (failedSource === props.src) return <div role="img" aria-label={fallbackLabel}
    className={`${props.fill ? 'absolute inset-0' : 'aspect-[4/3] w-full'} flex items-center justify-center bg-surface-sand p-16 text-center text-small text-text-secondary`}>{fallbackLabel}</div>;
  return <Image {...props} alt={props.alt} onError={() => setFailedSource(props.src)} />;
}
