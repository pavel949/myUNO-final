import React from 'react';

/**
 * The ring-and-point mark (doc 06 VerifiedBadge / trust points).
 * Gold fill is reserved for the public trust section; elsewhere it inherits.
 */
export function TrustMark({
  size = 48,
  className,
  filled = false,
}: {
  size?: number;
  className?: string;
  filled?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <circle
        cx="12"
        cy="12"
        r="3"
        fill={filled ? '#D69A3A' : 'currentColor'}
        stroke="none"
      />
    </svg>
  );
}
