import React from 'react';

/**
 * Service-category icon set (doc 06 §icons, SA-1). The catalog
 * `catalog.service_categories` names an icon per category (car, broom, …);
 * this component renders it. Unknown names fall back to the generic mark so
 * an admin-added category never breaks the grid. 24×24 grid, stroke
 * `currentColor` — colour comes from the surrounding text token, never
 * hardcoded here.
 */

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const ICONS: Record<string, React.ReactNode> = {
  car: (
    <>
      <path d="M4 15v-3l2-5h12l2 5v3" />
      <path d="M4 12h16" />
      <circle cx="7.5" cy="16.5" r="1.7" />
      <circle cx="16.5" cy="16.5" r="1.7" />
    </>
  ),
  broom: (
    <>
      <path d="M15.5 3.5 10.8 11" />
      <path d="M10.8 11c-2.6 1.6-4.3 4.2-4.8 7.5 3.3-.1 6.2-1.3 8.2-3.6" />
      <path d="M9 14.5l2.5 3" />
    </>
  ),
  chef: (
    <>
      <path d="M8 13.5c-2 0-3.5-1.5-3.5-3.3C4.5 8.4 6 7 7.7 7c.4-1.7 2.2-3 4.3-3s3.9 1.3 4.3 3c1.7 0 3.2 1.4 3.2 3.2 0 1.8-1.5 3.3-3.5 3.3" />
      <path d="M8 13.5V19h8v-5.5" />
      <path d="M8 16.5h8" />
    </>
  ),
  map: (
    <>
      <path d="M9 5 4 7v12l5-2 6 2 5-2V5l-5 2-6-2Z" />
      <path d="M9 5v12M15 7v12" />
    </>
  ),
  ship: (
    <>
      <path d="M12 4v9" />
      <path d="M12 5c3 1 5 3 5.5 6H12" />
      <path d="M4.5 15h15l-2 4h-11l-2-4Z" />
    </>
  ),
  flower: (
    <>
      <circle cx="12" cy="9" r="2" />
      <path d="M12 4.5a2.2 2.2 0 0 1 0 4.4 2.2 2.2 0 0 1 0-4.4ZM16 7.5a2.2 2.2 0 0 1-2.2 3.8A2.2 2.2 0 0 1 16 7.5ZM8 7.5a2.2 2.2 0 0 0 2.2 3.8A2.2 2.2 0 0 0 8 7.5Z" />
      <path d="M12 11.5V19" />
      <path d="M12 16c-1.8 0-3.2-1-3.8-2.5M12 14.5c1.8 0 3.2-1 3.8-2.5" />
    </>
  ),
  droplet: (
    <path d="M12 4.5c3 3.6 5 6.4 5 9a5 5 0 0 1-10 0c0-2.6 2-5.4 5-9Z" />
  ),
  shirt: (
    <>
      <path d="M9 5 4.5 7.5 6 11l2-1v9h8v-9l2 1 1.5-3.5L15 5" />
      <path d="M9 5a3 3 0 0 0 6 0" />
    </>
  ),
  children: (
    <>
      <circle cx="8.5" cy="8" r="2.2" />
      <circle cx="15.5" cy="9.5" r="1.8" />
      <path d="M5.5 19v-3.2A3 3 0 0 1 8.5 13a3 3 0 0 1 3 2.8V19" />
      <path d="M13.5 19v-2.4a2.5 2.5 0 0 1 4.9 0V19" />
    </>
  ),
  spa: (
    <>
      <path d="M12 19c-4.5 0-7.5-2.6-8-6.5 3.1.2 5.4 1.2 8 3.6 2.6-2.4 4.9-3.4 8-3.6-.5 3.9-3.5 6.5-8 6.5Z" />
      <path d="M12 16c-1.3-2.8-1.3-6.7 0-11 1.3 4.3 1.3 8.2 0 11Z" />
    </>
  ),
  wrench: (
    <path d="M19.5 6.5a4.5 4.5 0 0 1-6 5.5l-6.2 6.2a1.8 1.8 0 0 1-2.5-2.5L11 9.5a4.5 4.5 0 0 1 5.5-6L14 6l1 3 3-1 1.5-1.5Z" />
  ),
  plus: (
    <>
      <rect x="4.5" y="4.5" width="15" height="15" rx="3" />
      <path d="M12 8.5v7M8.5 12h7" />
    </>
  ),
};

/** Generic mark for categories whose icon name has no drawing yet. */
const FALLBACK = (
  <>
    <circle cx="12" cy="12" r="7.5" />
    <path d="M12 8.5v.01M12 11v4.5" />
  </>
);

export const SERVICE_CATEGORY_ICON_NAMES = Object.keys(ICONS);

export function ServiceCategoryIcon({
  name,
  size = 28,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      {...STROKE}
    >
      {ICONS[name] ?? FALLBACK}
    </svg>
  );
}
