import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getProviderForIdentity } from '@/modules/services';
import { getConfig } from '@/modules/config';
import { getLabels } from '@/lib/i18n';
import ProviderApplyClient from './apply-client';

export const dynamic = 'force-dynamic';

/** F-PROV-1: the provider application form. One live application per identity. */
export default async function ProviderApplyPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/provider/apply');
  }

  const existing = await getProviderForIdentity(prisma, user.identityId);
  if (existing && existing.status !== 'offboarded') {
    redirect('/provider');
  }

  const catalog =
    ((await getConfig(prisma, 'catalog.service_categories')) as
      | { key: string }[]
      | null) ?? [];

  const categoryLabelDrafts = Object.fromEntries(
    catalog.map((c) => [`services.category.${c.key}`, c.key])
  );

  const labels: Record<string, string> = await getLabels({
    'provider.apply.title': 'Become a provider',
    'provider.apply.subtitle':
      'Tell us about your business. We vet every provider before their services go live.',
    'provider.apply.name': 'Business name',
    'provider.apply.description': 'What you do',
    'provider.apply.contact_email': 'Contact email',
    'provider.apply.contact_phone': 'Contact phone',
    'provider.apply.categories': 'Categories',
    'provider.apply.submit': 'Submit application',
    'provider.apply.success':
      'Application received. We will review it and notify you of the decision.',
    'provider.apply.error_generic': 'Could not submit the application. Please try again.',
    ...categoryLabelDrafts,
  });

  return (
    <ProviderApplyClient
      categories={catalog.map((c) => ({
        key: c.key,
        label: labels[`services.category.${c.key}`] || c.key,
      }))}
      labels={labels}
    />
  );
}
