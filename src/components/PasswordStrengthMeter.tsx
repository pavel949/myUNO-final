import React from 'react';

/**
 * Scores 0-4 from length and character variety. Not a rule the person has
 * to satisfy by guessing (canvas board 18) — just a signal, alongside the
 * server's own validatePasswordStrength (modules/auth), which is what
 * actually accepts or rejects the password.
 */
export function scorePasswordStrength(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 10) score++;
  if (password.length >= 14) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password) || /[^a-zA-Z0-9]/.test(password)) score++;
  return Math.min(score, 4);
}

const SEGMENT_COLOR: Record<number, string> = {
  1: 'bg-state-error',
  2: 'bg-state-warning',
  3: 'bg-state-success',
  4: 'bg-state-success',
};

interface PasswordStrengthMeterProps {
  password: string;
}

/** PasswordStrengthMeter — doc 06 phase 3 / board 18: strength as four segments. */
export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({ password }) => {
  const score = scorePasswordStrength(password);
  return (
    <div className="flex gap-4" role="img" aria-label={`Password strength: ${score} of 4`}>
      {[1, 2, 3, 4].map((segment) => (
        <div
          key={segment}
          className={`flex-1 h-4 rounded-sm ${segment <= score ? SEGMENT_COLOR[score] : 'bg-border-line'}`}
        />
      ))}
    </div>
  );
};
