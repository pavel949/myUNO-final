'use client';

import { createContext, useContext, forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { useLocale } from '@/components/LocaleProvider';
import { OPERATIONAL_STATIC_COPY } from '@/modules/content/operational-static.seed';

const CopyContext = createContext<Record<string, string>>({});
export function OperationalCopyProvider({ labels, children }: { labels: Record<string, string>; children: ReactNode }) {
  return <CopyContext.Provider value={labels}>{children}</CopyContext.Provider>;
}

/** Exact static copy lookup; never rewrites a DOM node, value, ID or user-entered content. */
export function operationalStaticText(text: string, locale: string): string {
  const normalized = text.replace(/\s+/g, ' ');
  const message = normalized.trim();
  const row = OPERATIONAL_STATIC_COPY[message];
  if (!row) return text;
  const translated = locale === 'ru' ? row.ru : locale === 'th' ? row.th || row.en : row.en;
  return normalized.replace(message, translated);
}

export function OperationalText({ text }: { text: string }) {
  const locale = useLocale();
  const labels = useContext(CopyContext);
  const message = text.replace(/\s+/g, ' ').trim();
  const key = OPERATIONAL_STATIC_COPY[message]?.key;
  return <>{key && labels[key] ? text.replace(message, labels[key]) : operationalStaticText(text, locale)}</>;
}

/** Translate the hint, while leaving name, value, validation and event handling unchanged. */
export const OperationalInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function OperationalInput(props, ref) {
  const locale = useLocale();
  const labels = useContext(CopyContext);
  const key = props.placeholder ? OPERATIONAL_STATIC_COPY[props.placeholder]?.key : undefined;
  const placeholder = key && labels[key] ? labels[key] : props.placeholder ? operationalStaticText(props.placeholder, locale) : undefined;
  return <input {...props} ref={ref} placeholder={placeholder} />;
});
