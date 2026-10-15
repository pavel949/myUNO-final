# SEO / GEO launch checklist (domain-independent)

## Current implementation
- Next.js server-side public pages; metadata via `generateMetadata`.
- `src/app/sitemap.ts` enumerates public projects, units and areas from published inventory.
- `src/app/robots.ts` disallows private areas and prevents indexing of preview/temporary hosts.
- `src/lib/seo.ts` provides canonical/hreflang and structured data for accommodation and FAQ.
- `src/app/llms.txt/route.ts` publishes machine-readable background information. This is not a guarantee of AI citations.

## Before connecting a custom domain
1. Audit every public page's actual server HTML: title, description, canonical, headings, meaningful body copy and JSON-LD.
2. Verify no draft, private or unavailable property appears in the sitemap. Check unit status at the DB query, not only UI.
3. Verify `?lang=` really selects language server-side and is crawlable before enabling hreflang. Do not advertise untranslated pages.
4. Review each project and unit description in CMS: unique verified location, size, beds, facilities, pricing basis, operating entity, photos and policies. Do not invent attributes or claim licenses without evidence.
5. Validate structured data against rendered page content and Google's Rich Results Test; do not promise rich results.
6. Check sitemap and robots in an actual deployment, and ensure sitemap errors are observable (currently DB failures silently fall back to static URLs).
7. Run `npm test`, `npm run lint`, `npm run build`, and verify on mobile.
8. Keep non-public dashboards, guest records, payment pages and admin routes excluded from search.

## When the domain is available
1. Set `NEXT_PUBLIC_SITE_URL=https://your-domain` in production Vercel settings; keep `NEXTAUTH_URL` independently correct for authentication.
2. Confirm HTTPS, host redirects, canonical origin, `robots.txt`, `sitemap.xml` and `llms.txt`.
3. Configure Google Search Console, Bing Webmaster Tools and analytics with verified ownership.
4. Submit the sitemap, inspect representative project/unit URLs, and track indexing and organic conversions.
5. Only enable IndexNow with a verified host key and event-driven notifications for actually published URLs; do not send drafts or personal URLs.

## Editorial standard
Write for actual Phuket traveler, renter, buyer and owner questions. Prefer clear, sourced facts over generic marketing. Keep EN/RU/TH/ZH variants consistent and mark missing translations for review. GEO performance requires independently useful, accessible and trustworthy pages; `llms.txt` alone does not establish discoverability.

## Known follow-ups
- Existing `publicPageAlternates` uses query-parameter locales: verify server responses and reciprocal hreflang.
- Confirm which search/filter routes should be `noindex`; they must not create infinite crawl combinations.
- Review `llms.txt` claims (payment methods, licensing, compliance) with operations/legal before launch.
- Assess data-dependent sitemap failures, large inventory pagination and automated content quality gates.
