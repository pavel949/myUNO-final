import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'sun';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-brand-andaman text-surface-ivory hover:bg-brand-deep focus-visible:ring-2 focus-visible:ring-brand-andaman focus-visible:ring-offset-2',
  secondary: 'bg-surface-paper text-text-ink border border-border-line hover:border-border-line-2 focus-visible:ring-2 focus-visible:ring-brand-andaman focus-visible:ring-offset-2',
  ghost: 'text-brand-andaman hover:bg-surface-paper focus-visible:ring-2 focus-visible:ring-brand-andaman focus-visible:ring-offset-2',
  destructive: 'bg-state-error text-surface-ivory hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-state-error focus-visible:ring-offset-2',
  sun: 'bg-brand-sun text-brand-deep hover:bg-brand-sun-soft focus-visible:ring-2 focus-visible:ring-brand-sun focus-visible:ring-offset-2',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-40 px-16 text-small rounded-md',
  md: 'h-48 px-24 text-body rounded-md',
  lg: 'h-56 px-32 text-subtitle rounded-lg',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      fullWidth = false,
      disabled,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const baseClasses = 'inline-flex items-center justify-center font-medium transition-colors duration-micro disabled:opacity-50 disabled:cursor-not-allowed';
    const variantClass = variantClasses[variant];
    const sizeClass = sizeClasses[size];
    const widthClass = fullWidth ? 'w-full' : '';

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseClasses} ${variantClass} ${sizeClass} ${widthClass} ${className || ''}`}
        {...props}
      >
        {isLoading ? (
          <svg
            className="animate-spin h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
