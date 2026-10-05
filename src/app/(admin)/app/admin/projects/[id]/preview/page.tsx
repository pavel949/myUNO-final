import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getProjectExperienceActor } from '@/app/libs/projectExperienceGuard';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { tMany } from '@/modules/content';
import ProjectEditorialSections from '@/components/projects/ProjectEditorialSections';
import ProjectAmenitiesSection from '@/components/projects/ProjectAmenitiesSection';
import ProjectWorkspaceNav from '@/components/projects/ProjectWorkspaceNav';
import { categoryEditorialKeys } from '@/modules/projects';

export const dynamic = 'force-dynamic';

/** Private project-space preview. Does not make draft units discoverable/bookable. */
export default async function ProjectSpacePreview({ params }: { params: { id: string } }) {
  const viewer = await getCurrentUser();
  if (!viewer) redirect('/login?next=' + encodeURIComponent('/app/admin/projects/' + params.id + '/preview'));
  const actor = await getProjectExperienceActor(params.id);
  if (!actor) notFound();
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      area: { select: { nameKey: true, descriptionKey: true } },
      coverMedia: { select: { storageKey: true } },
      galleryMedia: { orderBy: { sort: 'asc' }, include: { media: { select: { storageKey: true } } } },
      amenities: {
        orderBy: [{ isFeatured: 'desc' }, { sort: 'asc' }, { name: 'asc' }],
        include: {
          coverMedia: { select: { storageKey: true } },
          media: { orderBy: [{ sort: 'asc' }, { mediaId: 'asc' }], include: { media: { select: { storageKey: true } } } },
        },
      },
      inventoryCategories: { orderBy: { name: 'asc' }, select: {
        id: true, name: true, categoryKey: true, bedrooms: true, status: true,
        units: { select: {
          id: true, name: true, status: true, coverMedia: { select: { storageKey: true } },
          _count: { select: { media: true } },
        } },
      } },
    },
  });
  if (!project) notFound();
  const labels = await getLabels({
    'admin.project_preview.private': 'Private preview · not published',
    'admin.project_preview.project360': 'Project 360',
    'admin.project_preview.edit_media': 'Edit project media',
    'admin.project_preview.stats': '{categories} canonical categories · {units} physical units · {unitPhotos} linked unit photos · {projectPhotos} project gallery photos. Draft units are not available for booking.',
    'admin.project_preview.categories': 'Accommodation categories and exact units',
    'admin.project_preview.unit_stats': '{bedrooms} bedrooms · {units} villas · {status}',
    'admin.project_preview.photos': '{count} exact-unit photos · {status}',
    'admin.project_preview.amenities_title': 'Project amenities',
    'admin.project_preview.amenities_manage': 'Manage amenities →',
    'project_page.amenities.kicker': 'Project amenities',
    'project_page.amenities.included': 'Included',
    'project_page.amenities.free': 'Free',
    'project_page.amenities.booking_required': 'Booking required',
  });
  const prefix = `project.${project.slug}.editorial.`;
  const fields = ['eyebrow', 'headline', 'lead', 'benefits.title',
    ...[1, 2, 3, 4].flatMap(i => [`benefit.${i}.title`, `benefit.${i}.body`]),
    'location.title', 'location.body', 'groups.title', 'groups.body', 'groups.cta'];
  const descriptionKey = project.descriptionKey;
  const keys = [
    descriptionKey, ...fields.map(field => prefix + field),
    ...project.inventoryCategories.flatMap(category => {
      const { titleKey, descriptionKey } = categoryEditorialKeys(project.slug, category.id, category.categoryKey);
      return [titleKey, descriptionKey];
    }),
    ...(project.area ? [project.area.nameKey, project.area.descriptionKey].filter((key): key is string => Boolean(key)) : []),
  ];
  const content = await tMany(prisma, keys, getRequestLocale());
  const get = (field: string) => content[prefix + field] || '';
  const editorial = {
    eyebrow: get('eyebrow'), headline: get('headline'), lead: get('lead'),
    benefitsTitle: get('benefits.title'),
    benefits: [1,2,3,4].map(i => ({ title: get(`benefit.${i}.title`), body: get(`benefit.${i}.body`) })),
    locationTitle: get('location.title'), locationBody: get('location.body'),
    areaName: project.area ? content[project.area.nameKey] || '' : '',
    areaDescription: project.area?.descriptionKey ? content[project.area.descriptionKey] || '' : '',
    groupsTitle: get('groups.title'), groupsBody: get('groups.body'),
    groupsCta: '', // No booking action in a draft preview.
  };
  const photoCount = project.inventoryCategories.reduce((n,c) => n+c.units.reduce((m,u) => m+u._count.media,0),0);
  const amenities = project.amenities.map(row => ({
    id: row.id, slug: row.slug, name: row.name, categoryKey: row.categoryKey,
    shortDescription: row.shortDescription, description: row.description, iconKey: row.iconKey,
    locationLabel: row.locationLabel, accessType: row.accessType, accessInstructions: row.accessInstructions,
    bookingRequired: row.bookingRequired, bookingMode: row.bookingMode, bookingUrl: row.bookingUrl,
    pricingType: row.pricingType, priceThb: row.priceThb, capacity: row.capacity, minAge: row.minAge,
    openingHours: row.openingHours, rules: row.rules, terms: row.terms, isFeatured: row.isFeatured,
    coverUrl: row.coverMedia?.storageKey ?? row.media[0]?.media.storageKey ?? null,
    galleryUrls: row.media.map(item => item.media.storageKey),
  }));
  return <main className="min-h-screen bg-surface-ivory pb-64">
    <div className="mx-auto max-w-6xl px-24 pt-24"><ProjectWorkspaceNav projectId={project.id} active={'preview'} contentOnly={!actor.isAdmin} /></div>
    <header className="border-b border-border-line bg-surface-paper px-24 py-16">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-12">
        <div><p className="text-kicker text-brand-andaman">{labels['admin.project_preview.private']}</p>
          <h1 className="font-display text-heading-2 font-semibold text-text-ink">{project.name}</h1></div>
        <div className="flex gap-12">
          <Link href={`/app/admin/projects/${project.id}`} className="font-semibold text-brand-andaman underline">{labels['admin.project_preview.project360']}</Link>
          <Link href={`/app/admin/properties/${project.id}/onboarding?gallery=project:${project.id}#step-7`} className="font-semibold text-brand-andaman underline">{labels['admin.project_preview.edit_media']}</Link>
        </div>
      </div>
    </header>
    <section className="relative bg-brand-deep px-24 py-64 text-white">
      {project.coverMedia && <Image src={project.coverMedia.storageKey} alt={project.name} fill className="object-cover opacity-30" />}
      <div className="relative mx-auto max-w-6xl">
        <p className="text-small uppercase">{editorial.eyebrow || editorial.areaName || 'Residence'}</p>
        <h2 className="mt-12 font-display text-display-xl font-semibold">{project.name}</h2>
        <p className="mt-12">{content[descriptionKey] || project.address}</p>
      </div>
    </section>
    <section className="mx-auto max-w-6xl px-24 py-24">
      <p className="rounded-lg border border-border-line bg-surface-paper p-16 text-small text-text-secondary">
        {labels['admin.project_preview.stats']
          .replace('{categories}', String(project.inventoryCategories.length))
          .replace('{units}', String(project.inventoryCategories.reduce((n,c)=>n+c.units.length,0)))
          .replace('{unitPhotos}', String(photoCount))
          .replace('{projectPhotos}', String(project.galleryMedia.length))}
      </p>
      {project.galleryMedia.length > 0 && <div className="mt-16 grid grid-cols-2 gap-8 md:grid-cols-4">
        {project.galleryMedia.map(row => <Image key={row.mediaId} src={row.media.storageKey} alt={project.name} width={500} height={320} className="aspect-video w-full rounded-lg object-cover"/>)}
      </div>}
    </section>
    <ProjectEditorialSections editorial={editorial} projectId={project.id} />
    <ProjectAmenitiesSection
      projectSlug={project.slug}
      amenities={amenities}
      title={labels['admin.project_preview.amenities_title']}
      viewAllLabel={labels['admin.project_preview.amenities_manage']}
      viewAllHref={`/app/admin/projects/${project.id}/experience`}
      detailHrefFor={() => `/app/admin/projects/${project.id}/experience`}
      labels={{
        kicker: labels['project_page.amenities.kicker'],
        included: labels['project_page.amenities.included'],
        free: labels['project_page.amenities.free'],
        bookingRequired: labels['project_page.amenities.booking_required'],
      }}
    />
    <section className="mx-auto max-w-6xl px-24 py-48">
      <h2 className="mb-24 font-display text-heading-2 font-semibold">{labels['admin.project_preview.categories']}</h2>
      <div className="grid gap-16 md:grid-cols-2">
        {project.inventoryCategories.map(category => {
          const { titleKey, descriptionKey } = categoryEditorialKeys(project.slug, category.id, category.categoryKey);
          return <article key={category.id} className="rounded-md border border-border-line bg-surface-paper p-24">
            <h3 className="font-display text-heading-3 font-semibold">{category.name}</h3>
            <p className="mt-4 text-small text-text-secondary">{labels['admin.project_preview.unit_stats'].replace('{bedrooms}', String(category.bedrooms)).replace('{units}', String(category.units.length)).replace('{status}', category.status)}</p>
            {content[titleKey] && <p className="mt-8 font-medium text-brand-andaman">{content[titleKey]}</p>}
            {content[descriptionKey] && <p className="mt-12 text-small leading-relaxed text-text-secondary">{content[descriptionKey]}</p>}
            <div className="mt-16 grid grid-cols-2 gap-12">
              {category.units.map(unit => <Link key={unit.id} href={`/app/admin/units/${unit.id}`} className="rounded-lg border border-border-line p-8 hover:border-brand-andaman">
                {unit.coverMedia ? <Image src={unit.coverMedia.storageKey} alt={unit.name} width={300} height={180} className="aspect-video w-full rounded-md object-cover"/> : <div className="aspect-video rounded-md bg-surface-muted"/>}
                <p className="mt-8 font-semibold">{unit.name}</p>
                <p className="text-small text-text-secondary">{labels['admin.project_preview.photos'].replace('{count}', String(unit._count.media)).replace('{status}', unit.status)}</p>
              </Link>)}
            </div>
          </article>;
        })}
      </div>
    </section>
  </main>;
}
