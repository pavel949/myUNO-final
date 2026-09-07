import React from 'react';
import { statusClasses } from '@/lib/status';

type ChipVariant = 'filter' | 'status' | 'neutral';
type ChipStatus =
  | 'confirmed'
  | 'pending_payment'
  | 'requested'
  | 'declined'
  | 'cancelled'
  | 'closed'
  | 'checked_in'
  | 'default';

interface ChipProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  children: React.ReactNode;
  variant?: ChipVariant;
  status?: ChipStatus;
  isActive?: boolean;
  isSelectable?: boolean;
  icon?: React.ReactNode;
}


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
      // Resolved through the doc 06 §3.4 single mapping, never chosen here.
      chipClasses += ` ${statusClasses(status)}`;
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
