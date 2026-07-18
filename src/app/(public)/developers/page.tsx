import { Metadata } from 'next';
import { AudiencePage, audienceMetadata, AudienceCopy } from '@/app/(public)/audience-page';

export const dynamic = 'force-dynamic';

const copy: AudienceCopy = {
  slug: 'developers',
  titleDraft: 'For Developers',
  subtitleDraft: 'Uplift your project class. Managed platform, integrated ops.',
  ctaDraft: 'Talk to us',
  ctaHref: 'mailto:pavel@ignatevestate.com',
};

export async function generateMetadata(): Promise<Metadata> {
  return audienceMetadata(copy);
}

export default async function DevelopersPage() {
  return <AudiencePage copy={copy} />;
}
