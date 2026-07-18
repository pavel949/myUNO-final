import { Metadata } from 'next';
import { AudiencePage, audienceMetadata, AudienceCopy } from '@/app/(public)/audience-page';

export const dynamic = 'force-dynamic';

const copy: AudienceCopy = {
  slug: 'guests',
  titleDraft: 'For Guests',
  subtitleDraft: 'Hotels unnecessary. Here: home, safety, support.',
  ctaDraft: 'Search stays',
  ctaHref: '/search',
};

export async function generateMetadata(): Promise<Metadata> {
  return audienceMetadata(copy);
}

export default async function GuestsPage() {
  return <AudiencePage copy={copy} />;
}
