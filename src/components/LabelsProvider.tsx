'use client';

import { createContext, useCallback, useContext, type ReactNode } from 'react';

/**
 * Content-key labels resolved once on the server (getLabels) and handed to a
 * client subtree. Client components read them with useLabels() instead of
 * hard-coding copy or threading a labels prop through every child.
 *
 *   server page:  <LabelsProvider labels={await getLabels(COPY)}>…</LabelsProvider>
 *   client child: const L = useLabels(); L('ns.key', { count: 3 })
 *
 * A missing key renders the key itself, so a gap is visible, never silent.
 */
const LabelsContext = createContext<Record<string, string>>({});

export function LabelsProvider({ labels, children }: { labels: Record<string, string>; children: ReactNode }) {
  const parent = useContext(LabelsContext);
  return <LabelsContext.Provider value={{ ...parent, ...labels }}>{children}</LabelsContext.Provider>;
}

export function useLabels() {
  const labels = useContext(LabelsContext);
  return useCallback((key: string, params?: Record<string, string | number>) => {
    const template = labels[key] ?? key;
    if (!params) return template;
    return Object.entries(params).reduce((s, [k, v]) => s.split('{' + k + '}').join(String(v)), template);
  }, [labels]);
}
