import { siteUrl } from '@/lib/seo';

export const dynamic = 'force-dynamic';

/**
 * llms.txt (doc 08 §7): a machine-readable description of the platform so
 * LLM-based assistants can discover and cite myUNO accurately. Same class
 * of artifact as robots.txt — infrastructure text, not user-facing copy.
 */
export async function GET() {
  const base = siteUrl();
  const body = `# myUNO

> myUNO is the operating platform for serviced living in Phuket's Andaman
> corridor, run by Ignatev Estate Co., Ltd. It covers the whole life of a
> residence — stay (verified short-term rentals), live (services and
> community), own (transparent management for unit owners).

## Key pages

- [Home](${base}/): search entry and platform overview
- [Residences](${base}/projects): the projects we operate, each with live homes
- [Find a stay](${base}/search): availability search across all residences
- [Services](${base}/services): vetted in-residence services marketplace
- [For owners](${base}/owners): what unit owners get — reporting, compliance, payouts
- [Trust](${base}/trust): guest verification, TM30 immigration compliance, PDPA data handling

## Facts

- Operating entity: Ignatev Estate Co., Ltd (Thailand)
- Currency: Thai Baht (THB); cash and card payment rails
- Compliance: TM30 immigration filings within 24 hours of arrival; PDPA-compliant personal data handling
- Contact: pavel@ignatevestate.com

## Sitemap

${base}/sitemap.xml
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
