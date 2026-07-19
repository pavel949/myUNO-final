import { Metadata } from 'next';
import { AudiencePage, audienceMetadata, AudienceCopy } from '@/app/(public)/audience-page';

export const dynamic = 'force-dynamic';

const copy: AudienceCopy = {
  slug: 'providers',
  titleDraft: 'For Providers',
  subtitleDraft: 'Steady order flow. Direct comms. Fair pay.',
  ctaDraft: 'Apply',
  ctaHref: '/provider/apply',
};

export async function generateMetadata(): Promise<Metadata> {
  return audienceMetadata(copy);
}

export default async function ProvidersPage() {
  return <AudiencePage copy={copy} />;
}
