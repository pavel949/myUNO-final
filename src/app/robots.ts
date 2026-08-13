import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/seo';

/**
 * robots.txt (doc 08 §7): crawlers get the public marketing and discovery
 * surfaces; API routes and every authenticated portal stay out of the index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/app/',
          '/ops',
          '/owner',
          '/mc',
          '/provider',
          '/messages',
          '/tickets',
          '/trips',
          '/bookings/',
          '/checkout/',
          '/auth/',
          '/login',
          '/register',
        ],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
