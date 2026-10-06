import type { ReactNode } from 'react';
import Link from 'next/link';

/**
 * Page-level Stitch compositions shared by public, guest, portal and admin
 * surfaces. They only arrange content with the stitch-* classes and design
 * tokens; data, actions and permissions stay with each page.
 */

/** Full page on the Stitch workspace background with the standard container. */
export function StitchMain({ children, className = '', narrow = false }: { children: ReactNode; className?: string; narrow?: boolean }) {
  return (
    <main className="stitch-workspace">
      <div className={`stitch-page space-y-24 ${narrow ? 'max-w-4xl' : ''} ${className}`}>{children}</div>
    </main>
  );
}

/** Page title block: kicker, title, subtitle and actions, aligned like RecordPageHeader. */
export function PageHeading({
  kicker, title, subtitle, actions, children,
}: { kicker?: ReactNode; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex flex-col gap-16 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {kicker ? <p className="stitch-kicker">{kicker}</p> : null}
        <h1 className="mt-4 break-words font-display text-display-xl font-semibold tracking-[-0.02em] text-text-ink hyphens-auto">{title}</h1>
        {subtitle ? <div className="mt-8 max-w-3xl text-body text-text-secondary">{subtitle}</div> : null}
        {children}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-8">{actions}</div> : null}
    </header>
  );
}

/** A titled content panel. */
export function Panel({
  title, kicker, actions, children, soft = false, className = '', id,
}: {
  title?: ReactNode; kicker?: ReactNode; actions?: ReactNode; children: ReactNode;
  soft?: boolean; className?: string; id?: string;
}) {
  return (
    <section id={id} className={`${soft ? 'stitch-panel-soft' : 'stitch-panel'} min-w-0 break-words p-20 md:p-24 ${className}`}>
      {title || kicker || actions ? (
        <div className="mb-16 flex flex-wrap items-start justify-between gap-12">
          <div>
            {kicker ? <p className="stitch-kicker">{kicker}</p> : null}
            {title ? <h2 className="mt-4 font-display text-title font-semibold text-text-ink">{title}</h2> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-8">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Marketing / landing hero. `dark` uses the brand-deep variant. */
export function PublicHero({
  kicker, title, body, actions, aside, dark = false,
}: { kicker?: ReactNode; title: ReactNode; body?: ReactNode; actions?: ReactNode; aside?: ReactNode; dark?: boolean }) {
  return (
    <section className={dark ? 'stitch-hero-dark' : 'stitch-hero'}>
      <div className={aside ? 'grid gap-24 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] lg:items-start' : ''}>
        <div className="max-w-3xl">
          {kicker ? <p className={dark ? 'text-kicker font-semibold uppercase tracking-[0.16em] text-brand-sun' : 'stitch-kicker'}>{kicker}</p> : null}
          <h1 className={`mt-8 break-words font-display text-display-xl font-semibold tracking-[-0.02em] hyphens-auto ${dark ? 'text-white' : 'text-text-ink'}`}>{title}</h1>
          {body ? <div className={`mt-16 text-body ${dark ? 'text-surface-ivory/90' : 'text-text-secondary'}`}>{body}</div> : null}
          {actions ? <div className="mt-32 flex flex-wrap gap-12">{actions}</div> : null}
        </div>
        {aside ? <div>{aside}</div> : null}
      </div>
    </section>
  );
}

const linkTone = {
  primary: 'bg-brand-andaman text-surface-ivory hover:bg-brand-deep',
  secondary: 'border border-border-line bg-surface-paper text-text-ink hover:border-brand-andaman',
  light: 'bg-surface-ivory text-brand-andaman hover:bg-surface-paper',
  ghost: 'text-brand-andaman hover:underline',
} as const;

/** A link styled as a Stitch button (navigation, not an action). */
export function LinkButton({
  href, children, variant = 'primary', className = '',
}: { href: string; children: ReactNode; variant?: keyof typeof linkTone; className?: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-48 items-center justify-center rounded-lg px-24 py-12 font-semibold transition-colors duration-micro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-andaman focus-visible:ring-offset-2 ${linkTone[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}
