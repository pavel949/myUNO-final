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

export const LoadingState: React.FC<{ message?: string }> = ({
  message = 'Loading...',
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-80 px-16">
      <div className="animate-spin mb-24">
        <div className="w-56 h-56 border-4 border-border-line border-t-brand-andaman rounded-full" />
      </div>
      <p className="text-body text-text-stone">{message}</p>
    </div>
  );
};

interface ErrorStateProps {
  title: string;
  description?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title,
  description,
  onRetry,
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
          Retry
        </Button>
      )}
    </div>
  );
};
