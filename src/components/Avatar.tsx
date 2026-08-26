import React from 'react';
import Image from 'next/image';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  initials?: string;
  src?: string;
  alt?: string;
  size?: AvatarSize;
  className?: string;
}

const sizeClasses: Record<AvatarSize, string> = {
  xs: 'w-24 h-24 text-small',
  sm: 'w-32 h-32 text-body',
  md: 'w-40 h-40 text-title',
  lg: 'w-64 h-64 text-display',
  xl: 'w-80 h-80 text-display-xl',
};

export const Avatar: React.FC<AvatarProps> = ({
  initials,
  src,
  alt,
  size = 'md',
  className,
}) => {
  const sizeClass = sizeClasses[size];

  if (src) {
    const sizeMap: Record<AvatarSize, number> = {
      xs: 24,
      sm: 32,
      md: 40,
      lg: 64,
      xl: 80,
    };
    const dimension = sizeMap[size];

    return (
      <Image
        src={src}
        alt={alt || 'Avatar'}
        width={dimension}
        height={dimension}
        className={`
          rounded-full object-cover
          ${sizeClass}
          ${className || ''}
        `}
      />
    );
  }

  return (
    <div
      className={`
        rounded-full bg-border-line flex items-center justify-center
        text-text-ink font-medium
        ${sizeClass}
        ${className || ''}
      `}
    >
      {initials || '?'}
    </div>
  );
};
