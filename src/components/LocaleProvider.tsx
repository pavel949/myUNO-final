'use client';

import { createContext, useContext, type ReactNode } from 'react';

/**
 * The request's UI locale, handed to client components once from the root
 * layout (which reads it from the cookie on the server). Client components
 * cannot read cookies themselves without breaking the server render, and
 * threading a `locale` prop through every page was how dates ended up
 * formatted with no locale at all.
 */
const LocaleContext = createContext<string>('ru');

export function LocaleProvider({ locale, children }: { locale: string; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): string {
  return useContext(LocaleContext);
}
