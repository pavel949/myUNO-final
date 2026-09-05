import React from 'react';
import { TrustMark } from './TrustMark';

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
      <TrustMark size={14} />
      {label}
    </Badge>
  );
};
