import type { ReactNode } from 'react';
import Link from 'next/link';

export type PremiumStatusTone = 'done' | 'active' | 'waiting' | 'blocked' | 'neutral';

const statusTone: Record<PremiumStatusTone, string> = {
  done: 'border-state-success/25 bg-state-success-soft text-state-success',
  active: 'border-brand-andaman/25 bg-brand-andaman/8 text-brand-andaman',
  waiting: 'border-brand-sun/30 bg-brand-sun/10 text-text-ink',
  blocked: 'border-state-error/30 bg-state-error-soft text-state-error',
  neutral: 'border-border-line bg-surface-ivory text-text-secondary',
};

export function StatusChip({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: PremiumStatusTone;
}) {
  return (
    <span className={`inline-flex min-h-28 items-center rounded-full border px-10 py-4 text-small font-semibold ${statusTone[tone]}`}>
      {children}
    </span>
  );
}

export function RecordPageHeader({
  eyebrow,
  title,
  subtitle,
  chips,
  actions,
  tabs,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  chips?: ReactNode;
  actions?: ReactNode;
  tabs?: Array<{ label: string; href: string; active?: boolean }>;
}) {
  return (
    <header className="border-b border-border-line bg-surface-paper">
      <div className="mx-auto max-w-7xl px-20 py-28 md:px-32 md:py-36">
        <div className="flex flex-col gap-24 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            {eyebrow ? <div className="text-small text-text-secondary">{eyebrow}</div> : null}
            <h1 className="mt-4 font-display text-display-xl font-semibold tracking-[-0.02em] text-text-ink">
              {title}
            </h1>
            {subtitle ? <div className="mt-8 max-w-3xl text-body text-text-secondary">{subtitle}</div> : null}
            {chips ? <div className="mt-16 flex flex-wrap gap-8">{chips}</div> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap gap-8">{actions}</div> : null}
        </div>

        {tabs?.length ? (
          <nav className="-mb-28 mt-28 flex gap-24 overflow-x-auto md:-mb-36" aria-label="Record sections">
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={tab.active ? 'page' : undefined}
                className={`shrink-0 border-b-2 pb-14 text-small font-semibold transition-colors duration-micro ${
                  tab.active
                    ? 'border-brand-andaman text-brand-andaman'
                    : 'border-transparent text-text-secondary hover:text-text-ink'
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
    </header>
  );
}

export function ProcessStepper({
  steps,
}: {
  steps: Array<{
    label: string;
    state: PremiumStatusTone;
    detail?: string;
  }>;
}) {
  return (
    <ol className="grid gap-8 md:grid-cols-[repeat(auto-fit,minmax(120px,1fr))]" aria-label="Process">
      {steps.map((step, index) => (
        <li key={`${step.label}-${index}`} className="min-w-0">
          <div className="flex items-center gap-8">
            <span className={`flex h-28 w-28 shrink-0 items-center justify-center rounded-full border text-small font-semibold ${statusTone[step.state]}`}>
              {index + 1}
            </span>
            <div className={`h-px flex-1 ${index === steps.length - 1 ? 'invisible' : 'bg-border-line'}`} />
          </div>
          <p className="mt-8 text-small font-semibold text-text-ink">{step.label}</p>
          {step.detail ? <p className="mt-2 text-small text-text-secondary">{step.detail}</p> : null}
        </li>
      ))}
    </ol>
  );
}

export function KpiTile({
  label,
  value,
  delta,
  meta,
}: {
  label: ReactNode;
  value: ReactNode;
  delta?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <article className="rounded-xl border border-border-line bg-surface-paper p-20">
      <p className="text-small text-text-secondary">{label}</p>
      <div className="mt-8 flex items-baseline gap-8">
        <p className="font-display text-display font-semibold text-text-ink">{value}</p>
        {delta ? <span className="text-small font-semibold text-brand-andaman">{delta}</span> : null}
      </div>
      {meta ? <p className="mt-8 text-small text-text-secondary">{meta}</p> : null}
    </article>
  );
}

export function MoneyLine({
  label,
  amount,
  meta,
  emphasis = false,
}: {
  label: ReactNode;
  amount: ReactNode;
  meta?: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className={`flex items-start justify-between gap-20 border-b border-border-line py-12 last:border-b-0 ${emphasis ? 'font-semibold' : ''}`}>
      <div>
        <p className="text-body text-text-ink">{label}</p>
        {meta ? <p className="mt-2 text-small text-text-secondary">{meta}</p> : null}
      </div>
      <div className="shrink-0 text-right font-mono text-body tabular-nums text-text-ink">{amount}</div>
    </div>
  );
}

export function SourceChip({
  source,
  date,
  href,
}: {
  source: string;
  date?: string;
  href?: string;
}) {
  const content = (
    <>
      <span className="font-semibold">{source}</span>
      {date ? <span className="text-text-secondary"> · {date}</span> : null}
    </>
  );

  return href ? (
    <Link href={href} className="inline-flex rounded-full border border-border-line bg-surface-paper px-10 py-6 text-small text-text-ink hover:border-border-line-2">
      {content}
    </Link>
  ) : (
    <span className="inline-flex rounded-full border border-border-line bg-surface-paper px-10 py-6 text-small text-text-ink">
      {content}
    </span>
  );
}

export function StandardFilterBar({
  children,
  clearHref,
  clearLabel = 'Clear',
}: {
  children: ReactNode;
  clearHref?: string;
  clearLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-end gap-8 rounded-xl border border-border-line bg-surface-paper p-12">
      <div className="flex min-w-0 flex-1 flex-wrap gap-8">{children}</div>
      {clearHref ? (
        <Link href={clearHref} className="inline-flex min-h-44 items-center px-10 text-small font-semibold text-brand-andaman hover:underline">
          {clearLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function InboxItem({
  eyebrow,
  title,
  subtitle,
  sla,
  action,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  sla?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <article className="flex flex-col gap-12 border-b border-border-line py-16 last:border-b-0 md:flex-row md:items-center">
      <div className="min-w-0 flex-1">
        {eyebrow ? <p className="text-small font-semibold text-brand-andaman">{eyebrow}</p> : null}
        <h3 className="mt-2 text-body font-semibold text-text-ink">{title}</h3>
        {subtitle ? <p className="mt-4 text-small text-text-secondary">{subtitle}</p> : null}
      </div>
      {sla ? <div className="shrink-0 font-mono text-small tabular-nums text-text-secondary">{sla}</div> : null}
      {action ? <div className="shrink-0">{action}</div> : null}
    </article>
  );
}

export function CtaBar({
  summary,
  secondary,
  primary,
}: {
  summary?: ReactNode;
  secondary?: ReactNode;
  primary: ReactNode;
}) {
  return (
    <div className="sticky bottom-0 z-30 border-t border-border-line bg-surface-paper/95 px-16 py-12 shadow-float backdrop-blur md:static md:rounded-xl md:border md:px-20">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-16">
        <div className="min-w-0 flex-1">{summary}</div>
        <div className="flex shrink-0 items-center gap-8">
          {secondary}
          {primary}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border-line bg-surface-paper p-24">
      <h3 className="font-display text-title font-semibold text-text-ink">{title}</h3>
      {body ? <div className="mt-8 max-w-2xl text-body text-text-secondary">{body}</div> : null}
      {action ? <div className="mt-20">{action}</div> : null}
    </div>
  );
}
