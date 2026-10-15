import Link from 'next/link';
import { getLabels } from '@/lib/i18n';

const STEPS = [
  { key: 'area', href: '/projects' },
  { key: 'home', href: '/homes?intent=rent' },
  { key: 'arrival', href: '/services' },
  { key: 'help', href: '/help' },
] as const;

export default async function RelocationPage() {
  const labels = await getLabels({
    'relocation.kicker': 'Relocating to Phuket',
    'relocation.title': 'A clear path to your new life in Phuket',
    'relocation.intro': 'Explore neighbourhoods, find a home and plan your arrival. Offers and availability are confirmed on the relevant pages.',
    'relocation.area.title': 'Choose an area',
    'relocation.area.detail': 'Explore neighbourhoods and local infrastructure',
    'relocation.area.action': 'Explore projects',
    'relocation.home.title': 'Find a home',
    'relocation.home.detail': 'Browse long-term rental offers',
    'relocation.home.action': 'Find homes',
    'relocation.arrival.title': 'Plan your arrival',
    'relocation.arrival.detail': 'Transfers and local services',
    'relocation.arrival.action': 'Browse services',
    'relocation.help.title': 'Get guidance',
    'relocation.help.detail': 'Ask the team about schools, paperwork and other needs',
    'relocation.help.action': 'Contact the team',
  });
  return (
    <main className="mx-auto max-w-content px-20 py-48 md:px-32">
      <p className="text-small font-semibold uppercase tracking-wider text-brand-andaman">{labels['relocation.kicker']}</p>
      <h1 className="mt-12 max-w-3xl font-display text-display-hero font-semibold leading-tight hyphens-none text-text-ink">{labels['relocation.title']}</h1>
      <p className="mt-16 max-w-2xl text-body text-text-secondary">{labels['relocation.intro']}</p>
      <div className="mt-32 grid gap-16 md:grid-cols-2">
        {STEPS.map((step, index) => <article key={step.key} className="min-w-0 rounded-xl border border-border-line bg-surface-paper p-24">
          <span className="text-small font-semibold text-brand-andaman">{String(index + 1).padStart(2, '0')}</span>
          <h2 className="mt-8 font-display text-title font-semibold leading-snug hyphens-none text-text-ink">{labels[`relocation.${step.key}.title`]}</h2>
          <p className="mt-8 text-body text-text-secondary">{labels[`relocation.${step.key}.detail`]}</p>
          <Link className="mt-16 inline-block font-semibold text-brand-andaman hover:underline" href={step.href}>{labels[`relocation.${step.key}.action`]} →</Link>
        </article>)}
      </div>
    </main>
  );
}
