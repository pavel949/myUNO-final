'use client';

import React from 'react';

interface RoleContextBannerProps {
  /**
   * The already-resolved sentence, e.g. "You're viewing as owner of B-707".
   * Composed from content keys by the page — the component never writes copy.
   */
  message: string;
  /** Optional way back to the view that role normally lands on. */
  action?: {
    label: string;
    href: string;
  };
}

/**
 * Slim banner shown when someone is acting in a role that is not the one this
 * screen is built for (doc 06 §3). A person is one identity wearing several
 * hats — an owner sleeping in their own unit is still the guest of that stay
 * (F-OWN-6) — so instead of guessing which view they meant, we give them the
 * one their presence here implies and say plainly which hat is on.
 */
export const RoleContextBanner = React.forwardRef<HTMLDivElement, RoleContextBannerProps>(
  ({ message, action }, ref) => {
    return (
      <div
        ref={ref}
        role="status"
        className="flex flex-wrap items-center justify-between gap-8 bg-state-info-soft text-state-info px-16 py-12 mb-24"
      >
        <p className="text-small m-0">{message}</p>
        {action ? (
          <a
            href={action.href}
            className="text-small font-semibold text-state-info"
          >
            {action.label}
          </a>
        ) : null}
      </div>
    );
  }
);

RoleContextBanner.displayName = 'RoleContextBanner';
