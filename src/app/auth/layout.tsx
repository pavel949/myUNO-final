import type { ReactNode } from 'react';
import { StitchConsumerShell } from '@/components/stitch/StitchShells';

export default function Layout({ children }: { children: ReactNode }) {
  return <StitchConsumerShell>{children}</StitchConsumerShell>;
}
