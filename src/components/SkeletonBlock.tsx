import React from 'react';

type SkeletonShape = 'line' | 'card' | 'avatar';

interface SkeletonBlockProps {
  shape?: SkeletonShape;
  className?: string;
}

const shapeClass: Record<SkeletonShape, string> = {
  line: 'h-12 rounded-sm w-full',
  card: 'h-96 rounded-md w-full',
  avatar: 'h-40 w-40 rounded-full',
};

export function SkeletonBlock({ shape = 'line', className }: SkeletonBlockProps) {
  return (
    <div
      aria-hidden
      className={`bg-border-line/60 animate-pulse ${shapeClass[shape]} ${className || ''}`}
    />
  );
}
