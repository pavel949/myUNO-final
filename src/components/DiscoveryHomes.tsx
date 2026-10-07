import Link from 'next/link';
import Image from 'next/image';
import { discoveryDefaults } from '@/modules/content/discovery.seed';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import type { PublicDiscoveryUnit } from '@/modules/projects/public-discovery';

export async function discoveryCopy(locale: string) {
  const defaults = discoveryDefaults(locale);
  const labels = await getLabels(Object.fromEntries(Object.entries(defaults).map(([key, value]) => [`discovery.${key}`, value])));
  return Object.fromEntries(Object.keys(defaults).map(key => [key, labels[`discovery.${key}`]])) as typeof defaults;
}

export default async function DiscoveryHomes({ units, context = '' }: { units: PublicDiscoveryUnit[]; context?: string }) {
  const copy = await discoveryCopy(getRequestLocale());
  return <section className="mx-auto max-w-content px-20 py-32 md:px-32">
    <h2 className="font-display text-heading-2 font-semibold">{copy.browse}</h2>
    <p className="mb-24 mt-8 text-text-secondary">{copy.note}</p>
    {!units.length ? <p>{copy.empty}</p> : <div className="grid gap-24 sm:grid-cols-2 lg:grid-cols-3">
      {units.map(unit => {
        const query = new URLSearchParams(context);
        query.set('projectId', unit.project.id);
        return <article key={unit.id} className="overflow-hidden rounded-lg border border-border-line bg-surface-paper">
          <Link href={`/units/${unit.id}?${query}`} className="block focus-visible:outline-brand-andaman">
            {unit.coverUrl ? <Image src={unit.coverUrl} alt={unit.name} width={640} height={480} className="aspect-[4/3] w-full object-cover" /> : <p className="flex aspect-[4/3] items-center justify-center bg-surface-sand text-text-secondary">{copy.photos}</p>}
            <div className="p-20">
              <p className="text-small text-text-secondary">{unit.categoryName}</p>
              <h3 className="font-display text-heading-3 font-semibold">{unit.name}</h3>
              <p className="mt-8 text-small text-text-secondary">{unit.bedrooms} {copy.bedrooms} · {unit.maxGuests} {copy.guests}{unit.sizeSqm ? ` · ${unit.sizeSqm} m²` : ''}</p>
              <p className="mt-16 font-semibold text-brand-andaman">{copy.open} →</p>
            </div>
          </Link>
          <Link href={`/projects/${unit.project.slug}?${query}`} className="block border-t border-border-line px-20 py-12 text-small text-brand-andaman hover:underline">{unit.project.name} · {copy.project} →</Link>
        </article>;
      })}
    </div>}
  </section>;
}
