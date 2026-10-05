import type { ReactNode } from 'react';

/** Management-company workspace shell: marks the PMS touch-target scope (globals.css). */
export default function McLayout({ children }: { children: ReactNode }) {
  return <div className="pms-touch">{children}</div>;
}
