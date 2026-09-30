import Link from 'next/link';

const items = [
  { key: 'overview', label: 'Overview', href: (id: string) => `/app/admin/projects/${id}` },
  { key: 'experience', label: 'Experience', href: (id: string) => `/app/admin/projects/${id}/experience` },
  { key: 'media', label: 'Media', href: (id: string) => `/app/admin/projects/${id}/media` },
  { key: 'inventory', label: 'Inventory', href: (id: string) => `/app/admin/projects/${id}/inventory` },
  { key: 'calendar', label: 'Calendar', href: (id: string) => `/ops/calendar?projectId=${encodeURIComponent(id)}` },
  { key: 'concierge', label: 'Concierge', href: (id: string) => `/app/admin/projects/${id}/services` },
  { key: 'preview', label: 'Preview', href: (id: string) => `/app/admin/projects/${id}/preview` },
] as const;

export default function ProjectWorkspaceNav({
  projectId,
  active,
}: {
  projectId: string;
  active: typeof items[number]['key'];
}) {
  return <nav aria-label="Project workspace" className="mb-24 flex gap-4 overflow-x-auto rounded-xl border border-border-line bg-surface-paper p-4">
    {items.map(item => <Link key={item.key} href={item.href(projectId)} aria-current={active === item.key ? 'page' : undefined} className={`shrink-0 rounded-lg px-12 py-9 text-small font-semibold transition ${active === item.key ? 'bg-brand-andaman text-white' : 'text-text-secondary hover:bg-surface-ivory hover:text-text-ink'}`}>
      {item.label}
    </Link>)}
  </nav>;
}
