import Link from 'next/link';

export type ProjectPortalNavItem = {
  href: string;
  label: string;
};

export default function ProjectPortalNav({ items }: { items: ProjectPortalNavItem[] }) {
  if (!items.length) return null;
  return (
    <nav className="sticky top-0 z-30 border-y border-border-line bg-surface-paper/95 px-20 py-8 backdrop-blur">
      <div className="mx-auto flex max-w-6xl gap-4 overflow-x-auto">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="shrink-0 rounded-full px-12 py-8 text-small font-semibold text-text-secondary transition hover:bg-surface-ivory hover:text-brand-andaman"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
