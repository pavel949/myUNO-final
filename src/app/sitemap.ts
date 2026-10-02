import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/seo';
import { listBrowsableAreas, listPublicProjects, listPublicUnitIds } from '@/modules/projects';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * XML sitemap (doc 08 §7): the static public pages plus every live
 * project and live unit. Draft/paused inventory never appears. When the
 * database is unreachable (e.g. build-time render), the static pages
 * still ship so the sitemap never 500s.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, priority: 1.0 },
    { url: `${base}/projects`, priority: 0.9 },
    { url: `${base}/explore`, priority: 0.9 },
    { url: `${base}/stays`, priority: 0.8 },
    { url: `${base}/search`, priority: 0.8 },
    { url: `${base}/homes`, priority: 0.8 },
    { url: `${base}/homes?intent=buy`, priority: 0.8 },
    { url: `${base}/homes?intent=rent`, priority: 0.8 },
    { url: `${base}/sell`, priority: 0.7 },
    { url: `${base}/rent-out`, priority: 0.7 },
    { url: `${base}/manage`, priority: 0.7 },
    { url: `${base}/areas`, priority: 0.7 },
    { url: `${base}/services`, priority: 0.7 },
    { url: `${base}/owners`, priority: 0.6 },
    { url: `${base}/partners`, priority: 0.6 },
    { url: `${base}/guests`, priority: 0.6 },
    { url: `${base}/developers`, priority: 0.6 },
    { url: `${base}/buyers`, priority: 0.6 },
    { url: `${base}/management-companies`, priority: 0.6 },
    { url: `${base}/providers`, priority: 0.6 },
    { url: `${base}/trust`, priority: 0.5 },
    { url: `${base}/help`, priority: 0.5 },
    { url: `${base}/desks`, priority: 0.6 },
    { url: `${base}/desks/thailand`, priority: 0.5 },
    { url: `${base}/desks/russian-speaking`, priority: 0.5 },
    { url: `${base}/desks/greater-china`, priority: 0.5 },
    { url: `${base}/desks/middle-east`, priority: 0.5 },
    { url: `${base}/desks/europe`, priority: 0.5 },
    { url: `${base}/legal/terms`, priority: 0.3 },
    { url: `${base}/legal/privacy`, priority: 0.3 },
  ];

  try {
    const [projects, unitIds, areas] = await Promise.all([
      listPublicProjects(),
      listPublicUnitIds(),
      listBrowsableAreas(prisma),
    ]);

    return [
      ...staticPages,
      ...projects.flatMap((p) => [
        {
          url: `${base}/projects/${p.slug}`,
          priority: 0.8,
        },
        {
          url: `${base}/projects/${p.slug}/passport`,
          priority: 0.6,
        },
      ]),
      ...unitIds.map((id) => ({
        url: `${base}/units/${id}`,
        priority: 0.7,
      })),
      ...areas.map((area) => ({
        url: `${base}/areas/${area.slug}`,
        priority: 0.6,
      })),
    ];
  } catch {
    return staticPages;
  }
}
