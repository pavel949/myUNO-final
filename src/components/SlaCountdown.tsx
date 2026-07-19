'use client';

import { useEffect, useState } from 'react';

/**
 * Live countdown to an SLA deadline (doc 06 §3.2). Green-ish while time
 * remains, error-red once overdue. Re-renders every 30s; the deadline itself
 * is always computed server-side.
 */
export function SlaCountdown({
  deadline,
  leftTemplate,
  overdueLabel,
}: {
  deadline: string;
  leftTemplate: string; // contains {time}
  overdueLabel: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const msLeft = new Date(deadline).getTime() - now;
  if (msLeft <= 0) {
    return <span className="text-small font-semibold text-state-error">{overdueLabel}</span>;
  }

  const hours = Math.floor(msLeft / 3_600_000);
  const minutes = Math.floor((msLeft % 3_600_000) / 60_000);
  const time = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  const nearDeadline = msLeft < 2 * 3_600_000;

  return (
    <span
      className={
        nearDeadline
          ? 'text-small font-semibold text-state-warning'
          : 'text-small text-text-secondary'
      }
    >
      {leftTemplate.replace('{time}', time)}
    </span>
  );
}
