import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/seo';
import { listPublicProjects, listPublicUnitIds } from '@/modules/projects';

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
    { url: `${base}/search`, priority: 0.8 },
    { url: `${base}/services`, priority: 0.7 },
    { url: `${base}/owners`, priority: 0.6 },
    { url: `${base}/guests`, priority: 0.6 },
    { url: `${base}/developers`, priority: 0.6 },
    { url: `${base}/buyers`, priority: 0.6 },
    { url: `${base}/management-companies`, priority: 0.6 },
    { url: `${base}/providers`, priority: 0.6 },
    { url: `${base}/trust`, priority: 0.5 },
    { url: `${base}/legal/terms`, priority: 0.3 },
    { url: `${base}/legal/privacy`, priority: 0.3 },
  ];

  try {
    const [projects, unitIds] = await Promise.all([
      listPublicProjects(),
      listPublicUnitIds(),
    ]);

    return [
      ...staticPages,
      ...projects.map((p) => ({
        url: `${base}/projects/${p.slug}`,
        priority: 0.8,
      })),
      ...unitIds.map((id) => ({
        url: `${base}/units/${id}`,
        priority: 0.7,
      })),
    ];
  } catch {
    return staticPages;
  }
}
