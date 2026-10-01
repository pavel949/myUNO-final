import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { getPublicProjectBySlug } from '@/modules/projects';
import { tMany } from '@/modules/content';

export const dynamic = 'force-dynamic';

export default async function ProjectCategoryPage({
  params,
}: {
  params: { slug: string; categoryKey: string };
}) {
  const locale = getRequestLocale();
  const project = await getPublicProjectBySlug(params.slug, locale);
  if (!project) notFound();

  const category = project.categories.find(item => item.key === params.categoryKey);
  if (!category) notFound();
  const units = project.units.filter(unit => unit.categoryKey === category.key);
  const copy = await tMany(prisma, [category.titleKey, category.descriptionKey], locale);
  const labels = await getLabels({
    'project_category.back': 'Back to project',
    'project_category.available': '{count} homes in this category',
    'project_category.bedrooms': '{count} bedrooms',
    'project_category.from': 'from ฿{price} / night',
    'project_category.search': 'Check availability',
    'project_category.units': 'Exact homes in this category',
    'project_category.guests': 'Up to {count} guests',
    'project_category.size': '{count} sqm',
    'project_category.view_unit': 'View exact home →',
    'project_category.gallery': 'Category gallery',
  });

  return <main className="min-h-screen bg-surface-ivory">
    <header className="border-b border-border-line bg-surface-paper px-24 py-32">
      <div className="mx-auto max-w-6xl">
        <Link href={`/projects/${project.slug}`} className="text-small font-semibold text-brand-andaman hover:underline">
          ← {labels['project_category.back']} · {project.name}
        </Link>
        <h1 className="mt-12 font-display text-display-xl font-semibold text-text-ink">{category.name}</h1>
        {copy[category.titleKey] ? <p className="mt-8 text-heading-3 text-brand-andaman">{copy[category.titleKey]}</p> : null}
        {copy[category.descriptionKey] ? <p className="mt-12 max-w-3xl text-body text-text-secondary">{copy[category.descriptionKey]}</p> : null}
        <div className="mt-16 flex flex-wrap gap-8 text-small text-text-secondary">
          {category.bedrooms !== null ? <span className="rounded-full bg-surface-ivory px-12 py-4">{labels['project_category.bedrooms'].replace('{count}', String(category.bedrooms))}</span> : null}
          <span className="rounded-full bg-surface-ivory px-12 py-4">{labels['project_category.available'].replace('{count}', String(category.unitCount))}</span>
          {category.fromNightlyThb !== null ? <span className="rounded-full bg-surface-ivory px-12 py-4 font-semibold text-text-ink">{labels['project_category.from'].replace('{price}', Math.round(category.fromNightlyThb / 100).toLocaleString())}</span> : null}
        </div>
        <Link
          href={`/search?projectId=${encodeURIComponent(project.id)}&inventoryCategoryId=${encodeURIComponent(category.id)}`}
          className="mt-20 inline-flex min-h-44 items-center rounded-lg bg-brand-andaman px-20 font-semibold text-white"
        >
          {labels['project_category.search']}
        </Link>
      </div>
    </header>

    {category.galleryUrls.length > 0 ? <section className="mx-auto max-w-6xl px-24 py-32">
      <h2 className="mb-16 font-display text-heading-2 font-semibold text-text-ink">{labels['project_category.gallery']}</h2>
      <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
        {category.galleryUrls.slice(0,8).map((src,index)=><Image key={src+index} src={src} alt={category.name} width={640} height={420} className={`w-full rounded-lg object-cover ${index===0?'col-span-2 row-span-2 aspect-[4/3]':'aspect-video'}`}/>)}
      </div>
    </section> : null}

    <section className="mx-auto max-w-6xl px-24 py-40">
      <h2 className="mb-20 font-display text-heading-2 font-semibold text-text-ink">{labels['project_category.units']}</h2>
      <div className="grid gap-16 sm:grid-cols-2 lg:grid-cols-3">
        {units.map(unit => <Link key={unit.id} href={`/units/${unit.id}`} className="overflow-hidden rounded-xl border border-border-line bg-surface-paper transition hover:shadow-card">
          {unit.coverUrl ? <Image src={unit.coverUrl} alt={unit.name} width={640} height={360} className="aspect-video w-full object-cover"/> : <div className="aspect-video bg-surface-muted"/>}
          <div className="p-16">
            <p className="text-small text-brand-andaman">{category.name}</p>
            <h3 className="mt-4 font-semibold text-text-ink">{unit.name}</h3>
            <div className="mt-8 flex flex-wrap gap-8 text-small text-text-secondary">
              <span>{labels['project_category.guests'].replace('{count}',String(unit.maxGuests))}</span>
              {unit.sizeSqm ? <span>{labels['project_category.size'].replace('{count}',String(unit.sizeSqm))}</span> : null}
            </div>
            <p className="mt-12 text-small font-semibold text-brand-andaman">{labels['project_category.view_unit']}</p>
          </div>
        </Link>)}
      </div>
    </section>
  </main>;
}
