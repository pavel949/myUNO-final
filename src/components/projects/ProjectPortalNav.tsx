
export type ProjectPortalNavItem = {
  href: string;
  label: string;
};

export default function ProjectPortalNav({ items }: { items: ProjectPortalNavItem[] }) {
  if (!items.length) return null;
  return (
    <nav className="sticky top-64 z-30 border-y border-border-line bg-surface-paper/95 px-20 py-8 backdrop-blur md:px-32">
      <div className="mx-auto flex max-w-content gap-8 overflow-x-auto">
        {items.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="shrink-0 rounded-full border border-border-line bg-surface-sand px-16 py-8 text-small font-semibold text-text-secondary transition hover:border-brand-andaman hover:text-brand-andaman"
          >
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
