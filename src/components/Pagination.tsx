'use client';

import React from 'react';
import { Button } from './Button';

export interface PaginationProps {
  /** How many items are currently shown. */
  shown: number;
  /** Total items available. */
  total: number;
  /** Pre-resolved "Showing {shown} of {total}" line (already interpolated). */
  summary: string;
  /** Pre-resolved "Show more" label. */
  loadMoreLabel: string;
  /** Pre-resolved busy label. */
  loadingLabel: string;
  onLoadMore: () => void;
  isLoading?: boolean;
}

/**
 * Pagination — doc 06 §3 / S3. Progressive "show more" pager: the guest asks
 * for the next screenful rather than waiting for everything at once.
 */
export const Pagination: React.FC<PaginationProps> = ({
  shown,
  total,
  summary,
  loadMoreLabel,
  loadingLabel,
  onLoadMore,
  isLoading = false,
}) => {
  const hasMore = shown < total;
  return (
    <div className="mt-32 text-center">
      <p className="mb-16 text-small text-text-secondary" aria-live="polite">
        {summary}
      </p>
      {hasMore && (
        <Button variant="secondary" onClick={onLoadMore} isLoading={isLoading}>
          {isLoading ? loadingLabel : loadMoreLabel}
        </Button>
      )}
    </div>
  );
};

Pagination.displayName = 'Pagination';
