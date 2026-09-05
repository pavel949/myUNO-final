import React from 'react';
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
        aria-hidden
      >
        <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
        <circle cx="12" cy="12" r="2.5" strokeWidth={1.5} />
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
        aria-hidden
      >
        <circle cx="12" cy="12" r="9" strokeWidth={2} />
        <path d="M12 8v4.5" strokeWidth={2} strokeLinecap="round" />
        <circle cx="12" cy="16" r="1" fill="currentColor" stroke="none" />
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
