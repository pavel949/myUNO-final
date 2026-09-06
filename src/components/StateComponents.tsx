import React from 'react';
import Link from 'next/link';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-80 px-16 text-center">
      <svg
        className="w-48 h-48 text-text-stone mb-24"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
        />
      </svg>
      <h3 className="text-subtitle text-text-ink mb-12">{title}</h3>
      {description && <p className="text-body text-text-stone mb-24">{description}</p>}
      {action && (
        <Button onClick={action.onClick} variant="primary">
          {action.label}
        </Button>
      )}
    </div>
  );
};

interface LoadingStateProps {
  message?: string;
  labels?: Record<string, string>;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message,
  labels = {},
}) => {
  const displayMessage = message || labels['ui.state.loading_default'] || 'Loading...';
  return (
    <div className="flex flex-col items-center justify-center py-80 px-16">
      <div className="animate-spin mb-24">
        <div className="w-56 h-56 border-4 border-border-line border-t-brand-andaman rounded-full" />
      </div>
      <p className="text-body text-text-stone">{displayMessage}</p>
    </div>
  );
};

interface ErrorStateProps {
  title: string;
  description?: string;
  onRetry?: () => void;
  labels?: Record<string, string>;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title,
  description,
  onRetry,
  labels = {},
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-80 px-16 text-center">
      <svg
        className="w-48 h-48 text-state-error mb-24"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4v2m0 4v2m0-12a9 9 0 0 0-9 9 9 9 0 0018 0 9 9 0 00-9-9z"
        />
      </svg>
      <h3 className="text-subtitle text-text-ink mb-12">{title}</h3>
      {description && <p className="text-body text-text-stone mb-24">{description}</p>}
      {onRetry && (
        <Button onClick={onRetry} variant="primary">
          {labels['ui.state.error_retry'] || 'Retry'}
        </Button>
      )}
    </div>
  );
};

interface ForbiddenStateProps {
  title: string;
  description?: string;
  /** A navigational escape (href, not onClick) so this renders from a server component too — board 19: "forbidden" is the state a stay that has ended or a statement belonging to another owner needs, and both of those are server-rendered pages. */
  action?: {
    label: string;
    href: string;
  };
}

export const ForbiddenState: React.FC<ForbiddenStateProps> = ({ title, description, action }) => {
  return (
    <div className="flex flex-col items-center justify-center py-80 px-16 text-center">
      <svg
        className="w-48 h-48 text-text-stone mb-24"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <rect x="5" y="11" width="14" height="10" rx="2" strokeWidth={1.5} />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 11V7a4 4 0 118 0v4" />
      </svg>
      <h3 className="text-subtitle text-text-ink mb-12">{title}</h3>
      {description && <p className="text-body text-text-stone mb-24">{description}</p>}
      {action && (
        <Link
          href={action.href}
          className="inline-flex items-center h-48 px-24 rounded-md bg-brand-andaman text-surface-ivory font-medium"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
};

interface PartialStateProps {
  message: string;
}

/**
 * PartialState — board 19's "partial/stale" column: a chart with no history,
 * a figure computed from something that might be out of date. A small inline
 * notice rather than a full-page state, since the surface around it is still
 * usable — only the one figure or section is in question.
 */
export const PartialState: React.FC<PartialStateProps> = ({ message }) => {
  return (
    <div className="flex items-center gap-8 px-16 py-12 rounded-md bg-state-warning-soft text-state-warning">
      <svg className="w-20 h-20 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 9v4m0 4h.01M10.29 3.86l-8.18 14.18A1 1 0 003 19.5h18a1 1 0 00.89-1.46L13.71 3.86a1 1 0 00-1.72 0z"
        />
      </svg>
      <p className="text-small font-medium">{message}</p>
    </div>
  );
};
