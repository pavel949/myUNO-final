import Link from 'next/link';

/** Compact, keyboard-accessible project navigation; callers retain scope ownership. */
export default function OpsProjectFilter({
  label,
  allLabel,
  allHref,
  activeProjectId,
  options,
}: {
  label: string;
  allLabel: string;
  allHref: string;
  activeProjectId: string | null;
  options: Array<{ id: string; name: string; href: string }>;
}) {
  const active = options.find((option) => option.id === activeProjectId);
  const choices = [{ id: '', name: allLabel, href: allHref }, ...options];

  return (
    <details className="min-w-0 rounded-lg border border-border-line bg-surface-paper">
      <summary className="min-h-44 cursor-pointer break-words px-16 py-12 text-small text-text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-andaman">
        <span className="text-text-secondary">{label}: </span>
        <span className="font-semibold">{active?.name || allLabel}</span>
      </summary>
      <nav aria-label={label} className="flex max-h-[16rem] flex-col overflow-y-auto border-t border-border-line p-8">
        {choices.map((option) => (
          <Link
            key={option.id}
            href={option.href}
            aria-current={option.id === (active?.id || '') ? 'page' : undefined}
            className="flex min-h-44 items-center break-words rounded-md px-12 py-12 text-small text-text-ink hover:bg-surface-mint focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-andaman aria-[current=page]:bg-brand-andaman-soft aria-[current=page]:font-semibold"
          >
            <span className="min-w-0 break-words">{option.name}</span>
          </Link>
        ))}
      </nav>
    </details>
  );
}
