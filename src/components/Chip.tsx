import React from 'react';

type ChipVariant = 'filter' | 'status' | 'neutral';
type ChipStatus = 'confirmed' | 'pending_payment' | 'requested' | 'declined' | 'cancelled' | 'default';

interface ChipProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  children: React.ReactNode;
  variant?: ChipVariant;
  status?: ChipStatus;
  isActive?: boolean;
  isSelectable?: boolean;
  icon?: React.ReactNode;
}

const statusClasses: Record<ChipStatus, string> = {
  confirmed: 'bg-state-success-soft text-state-success',
  pending_payment: 'bg-state-warning-soft text-state-warning',
  requested: 'bg-state-warning-soft text-state-warning',
  declined: 'bg-state-error-soft text-state-error',
  cancelled: 'bg-state-error-soft text-state-error',
  default: 'bg-surface-paper text-text-ink border border-border-line',
};

export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  (
    {
      variant = 'filter',
      status = 'default',
      isActive = false,
      isSelectable = false,
      icon,
      children,
      className,
      ...props
    },
    ref
  ) => {
    let chipClasses = 'inline-flex items-center gap-8 px-16 py-8 rounded-full text-small font-medium transition-colors duration-micro';

    if (variant === 'status') {
      chipClasses += ` ${statusClasses[status]}`;
    } else if (variant === 'filter') {
      if (isActive) {
        chipClasses += ' bg-brand-andaman text-surface-ivory';
      } else {
        chipClasses += ' bg-surface-paper text-text-ink border border-border-line hover:border-border-line-2';
      }
    } else {
      chipClasses += ' bg-surface-paper text-text-ink border border-border-line';
    }

    const element = isSelectable ? 'button' : 'div';
    const Component = element as any;

    return (
      <Component
        ref={ref}
        type={isSelectable ? 'button' : undefined}
        className={`${chipClasses} ${className || ''}`}
        {...(isSelectable ? props : {})}
      >
        {icon && <span className="flex-shrink-0">{icon}</span>}
        <span>{children}</span>
      </Component>
    );
  }
);

Chip.displayName = 'Chip';
