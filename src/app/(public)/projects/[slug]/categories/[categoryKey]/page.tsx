import { UI_LOCALE } from '@/lib/format';
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
  const bookableUnits = units.filter(unit => unit.bookable);
  const unitEditorialKeys = units.flatMap(unit =>
    [unit.titleKey, unit.descriptionKey].filter((key): key is string => Boolean(key))
  );
  const unitFactKeys = units.flatMap(unit => [
    ...unit.views.map(view => `catalog.views.${view}.label`),
    ...unit.unitFeatures
      .filter(feature => /^[a-z0-9_]+$/.test(feature))
      .map(feature => `catalog.unit_features.${feature}.label`),
  ]);
  const copy = await tMany(
    prisma,
    [category.titleKey, category.descriptionKey, ...unitEditorialKeys, ...unitFactKeys],
    locale
  );
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
    'project_category.inquiry_unit': 'Ask about this home →',
    'project_category.pending': 'Exact photos or online booking terms are still being completed.',
    'project_category.gallery': 'Category gallery',
    'project_category.representative_media': 'Representative category photos',
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
          {category.fromNightlyThb !== null ? <span className="rounded-full bg-surface-ivory px-12 py-4 font-semibold text-text-ink">{labels['project_category.from'].replace('{price}', Math.round(category.fromNightlyThb / 100).toLocaleString(UI_LOCALE))}</span> : null}
        </div>
        {bookableUnits.length > 0 ? (
          <Link
            href={`/search?projectId=${encodeURIComponent(project.id)}&inventoryCategoryId=${encodeURIComponent(category.id)}`}
            className="mt-20 inline-flex min-h-44 items-center rounded-lg bg-brand-andaman px-20 font-semibold text-white"
          >
            {labels['project_category.search']}
          </Link>
        ) : (
          <Link
            href={`/projects/${project.slug}#lead-form`}
            className="mt-20 inline-flex min-h-44 items-center rounded-lg bg-brand-andaman px-20 font-semibold text-white"
          >
            {labels['project_category.inquiry_unit']}
          </Link>
        )}
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
        {units.map(unit => <Link
          key={unit.id}
          href={unit.bookable
            ? `/units/${unit.id}?projectId=${encodeURIComponent(project.id)}`
            : `/projects/${project.slug}#lead-form`}
          className="overflow-hidden rounded-xl border border-border-line bg-surface-paper transition hover:shadow-card"
        >
          {unit.coverUrl ? <Image src={unit.coverUrl} alt={unit.name} width={640} height={360} className="aspect-video w-full object-cover"/> : <div className="flex aspect-video items-center justify-center bg-surface-muted px-16 text-center text-small text-text-secondary">{labels['project_category.pending']}</div>}
          <div className="p-16">
            <p className="text-small text-brand-andaman">{category.name}</p>
            {unit.photoScope === 'room_type' ? (
              <p className="mt-4 text-small text-text-secondary">
                {labels['project_category.representative_media']}
              </p>
            ) : null}
            <h3 className="mt-4 font-semibold text-text-ink">{unit.name}</h3>
            {unit.titleKey && copy[unit.titleKey] ? (
              <p className="mt-4 text-small font-semibold text-brand-andaman">{copy[unit.titleKey]}</p>
            ) : null}
            {unit.descriptionKey && copy[unit.descriptionKey] ? (
              <p className="mt-8 line-clamp-3 text-small leading-relaxed text-text-secondary">{copy[unit.descriptionKey]}</p>
            ) : null}
            <div className="mt-8 flex flex-wrap gap-8 text-small text-text-secondary">
              {unit.maxGuests > 0 ? <span>{labels['project_category.guests'].replace('{count}',String(unit.maxGuests))}</span> : null}
              {(unit.grossAreaSqm || unit.sizeSqm) ? (
                <span>{labels['project_category.size'].replace('{count}',String(unit.grossAreaSqm || unit.sizeSqm))}</span>
              ) : null}
            </div>
            {(unit.views.length > 0 || unit.unitFeatures.some(feature => /^[a-z0-9_]+$/.test(feature))) ? (
              <div className="mt-8 flex flex-wrap gap-[6px]">
                {[
                  ...unit.views.map(view => ({
                    key: `view:${view}`,
                    label: copy[`catalog.views.${view}.label`] || view.replace(/_/g, ' '),
                  })),
                  ...unit.unitFeatures
                    .filter(feature => /^[a-z0-9_]+$/.test(feature))
                    .map(feature => ({
                      key: `feature:${feature}`,
                      label: copy[`catalog.unit_features.${feature}.label`] || feature.replace(/_/g, ' '),
                    })),
                ].slice(0, 4).map((fact) => (
                  <span key={fact.key} className="rounded-full bg-surface-ivory px-8 py-4 text-[12px] text-text-secondary">
                    {fact.label}
                  </span>
                ))}
              </div>
            ) : null}
            {!unit.bookable ? <p className="mt-8 text-small text-text-secondary">{labels['project_category.pending']}</p> : null}
            <p className="mt-12 text-small font-semibold text-brand-andaman">{unit.bookable ? labels['project_category.view_unit'] : labels['project_category.inquiry_unit']}</p>
          </div>
        </Link>)}
      </div>
    </section>
  </main>;
}
