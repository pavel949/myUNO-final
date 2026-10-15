import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/seo';

/**
 * robots.txt (doc 08 §7): crawlers get the public marketing and discovery
 * surfaces; API routes and every authenticated portal stay out of the index.
 */
export default function robots(): MetadataRoute.Robots {
  // Never invite indexing of local, preview or temporary Vercel hosts.
  const origin = new URL(siteUrl());
  const host = origin.hostname.toLowerCase();
  const indexable = origin.protocol === 'https:' &&
    host !== 'localhost' &&
    !host.endsWith('.vercel.app') &&
    !host.endsWith('.vercel.sh') &&
    process.env.VERCEL_ENV !== 'preview';
  if (!indexable) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }
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
