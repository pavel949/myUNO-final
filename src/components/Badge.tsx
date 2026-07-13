import React from 'react';

type BadgeVariant = 'default' | 'verified';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  className,
}) => {
  const baseClasses = 'inline-flex items-center gap-6 px-12 py-6 rounded-full text-small font-medium';
  const variantClasses =
    variant === 'verified'
      ? 'bg-state-success-soft text-state-success'
      : 'bg-surface-paper text-text-ink border border-border-line';

  return (
    <div className={`${baseClasses} ${variantClasses} ${className || ''}`}>
      {children}
    </div>
  );
};

interface VerifiedBadgeProps {
  label: string;
  className?: string;
}

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({
  label,
  className,
}) => {
  return (
    <Badge variant="verified" className={className}>
      <svg
        className="w-16 h-16 flex-shrink-0"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M6.267 3.455a3.066 3.066 0 001.745-2.77 3.066 3.066 0 00-3.58 3.048A3.066 3.066 0 006.267 3.455zm9.8 2.696a4.5 4.5 0 10-9.933-1.34 4.5 4.5 0 009.933 1.34z"
          clipRule="evenodd"
        />
      </svg>
      {label}
    </Badge>
  );
};
