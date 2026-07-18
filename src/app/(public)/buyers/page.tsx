import { Metadata } from 'next';
import { AudiencePage, audienceMetadata, AudienceCopy } from '@/app/(public)/audience-page';

export const dynamic = 'force-dynamic';

const copy: AudienceCopy = {
  slug: 'buyers',
  titleDraft: 'For Buyers',
  subtitleDraft: 'Purchase already underway? Our team eases the handoff.',
  ctaDraft: 'Start the conversation',
  ctaHref: 'mailto:pavel@ignatevestate.com',
};

export async function generateMetadata(): Promise<Metadata> {
  return audienceMetadata(copy);
}

export default async function BuyersPage() {
  return <AudiencePage copy={copy} />;
}
