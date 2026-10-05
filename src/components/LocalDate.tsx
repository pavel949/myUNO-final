'use client';

import { formatDate, type DateFormat } from '@/lib/date';
import { useLocale } from './LocaleProvider';

/** A date rendered in the visitor's UI locale and the operating time zone. */
export function LocalDate({
  value,
  format = 'date',
}: {
  value: Date | string | number | null | undefined;
  format?: DateFormat;
}) {
  const locale = useLocale();
  const text = formatDate(value, locale, format);
  if (!text) return null;
  const iso = (value instanceof Date ? value : new Date(value as string | number)).toISOString();
  return <time dateTime={iso}>{text}</time>;
}
