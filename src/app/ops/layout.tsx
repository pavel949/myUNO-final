import type { ReactNode } from 'react';

/** Operations workspace shell: marks the PMS touch-target scope (globals.css). */
export default function OpsLayout({ children }: { children: ReactNode }) {
  return <div className="pms-touch">{children}</div>;
}
