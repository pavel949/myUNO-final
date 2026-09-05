'use client';

const LOCALE_CODES = [
  { value: 'en', labelKey: 'en' },
  { value: 'ru', labelKey: 'ru' },
  { value: 'th', labelKey: 'th' },
  { value: 'zh', labelKey: 'zh' },
] as const;

export function LocaleSwitcher({
  locale,
  ariaLabel,
  optionLabels,
  variant = 'paper',
}: {
  locale: string;
  ariaLabel: string;
  optionLabels: { en: string; ru: string; th: string; zh: string };
  variant?: 'paper' | 'onDark';
}) {
  const field =
    variant === 'onDark'
      ? 'h-40 rounded-sm border border-surface-ivory/30 bg-text-ink px-8 text-small text-surface-ivory'
      : 'h-40 rounded-sm border border-border-line bg-surface-paper px-8 text-small text-text-ink';

  return (
    <select
      aria-label={ariaLabel}
      value={locale}
      onChange={(event) => {
        document.cookie = `locale=${event.target.value}; path=/; max-age=31536000; samesite=lax`;
        window.location.reload();
      }}
      className={field}
    >
      {LOCALE_CODES.map((item) => (
        <option key={item.value} value={item.value}>
          {optionLabels[item.labelKey]}
        </option>
      ))}
    </select>
  );
}
