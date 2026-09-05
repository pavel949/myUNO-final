import React from 'react';

type SkeletonShape = 'line' | 'card' | 'avatar';

interface SkeletonProps {
  shape?: SkeletonShape;
  className?: string;
  /** Only meaningful for `line` — CSS width, e.g. "60%". */
  width?: string;
}

const shapeClasses: Record<SkeletonShape, string> = {
  line: 'h-12 rounded-sm',
  card: 'h-96 rounded-md',
  avatar: 'w-40 h-40 rounded-full',
};

/**
 * Skeleton — doc 06 §3.1 `SkeletonBlock`: line/card/avatar shapes on
 * `border.line` at 60% opacity, 1.2s pulse. `animate-pulse` is disabled
 * globally under `prefers-reduced-motion` (globals.css), so this component
 * does not need its own reduced-motion branch.
 */
export const Skeleton: React.FC<SkeletonProps> = ({ shape = 'line', className, width }) => {
  return (
    <div
      className={`bg-border-line/60 animate-pulse ${shapeClasses[shape]} ${className || ''}`}
      style={width ? { width } : undefined}
      aria-hidden="true"
    />
  );
};
