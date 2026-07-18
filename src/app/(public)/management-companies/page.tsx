import { Metadata } from 'next';
import { AudiencePage, audienceMetadata, AudienceCopy } from '@/app/(public)/audience-page';

export const dynamic = 'force-dynamic';

const copy: AudienceCopy = {
  slug: 'mc',
  titleDraft: 'For Management Companies',
  subtitleDraft: 'Demanded ops. Single platform. More income.',
  ctaDraft: 'Learn more',
  ctaHref: 'mailto:pavel@ignatevestate.com',
};

export async function generateMetadata(): Promise<Metadata> {
  return audienceMetadata(copy);
}

export default async function ManagementCompaniesPage() {
  return <AudiencePage copy={copy} />;
}
