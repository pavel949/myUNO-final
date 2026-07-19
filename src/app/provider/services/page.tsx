import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getServicesByProvider } from '@/modules/services';
import { getConfig } from '@/modules/config';
import { getLabels } from '@/lib/i18n';
import ProviderServicesClient from './services-client';

export const dynamic = 'force-dynamic';

/** S13: the provider's own services editor (drafts gated on admin approval). */
export default async function ProviderServicesPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/provider/services');
  }
  const providerId = user.roles.find(
    (r) => r.role === 'provider_member' && r.providerId
  )?.providerId;
  if (!providerId) {
    redirect('/provider');
  }

  const [services, catalog] = await Promise.all([
    getServicesByProvider(prisma, providerId),
    getConfig(prisma, 'catalog.service_categories') as Promise<
      { key: string }[] | null
    >,
  ]);
  const categories = catalog ?? [];

  const categoryLabelDrafts = Object.fromEntries(
    categories.map((c) => [`services.category.${c.key}`, c.key])
  );

  const labels: Record<string, string> = await getLabels({
    'provider.services.title': 'My services',
    'provider.services.empty': 'No services yet — add your first one below.',
    'provider.services.new_title': 'Add a service',
    'provider.services.field_title': 'Title',
    'provider.services.field_description': 'Description',
    'provider.services.field_category': 'Category',
    'provider.services.field_price_model': 'Price model',
    'provider.services.field_price': 'Price (THB)',
    'provider.services.field_duration': 'Duration (minutes)',
    'provider.services.field_notice': 'Advance notice (hours)',
    'provider.services.create': 'Add service',
    'provider.services.save': 'Save',
    'provider.services.edit': 'Edit',
    'provider.services.draft_note':
      'New services start as drafts and go live after our review.',
    'provider.services.error_generic': 'Could not save. Please try again.',
    'provider.services.price_model.fixed': 'Fixed price',
    'provider.services.price_model.per_hour': 'Per hour',
    'provider.services.price_model.per_person': 'Per person',
    'provider.services.price_model.quote': 'Individual quote',
    'service.status.draft': 'Draft',
    'service.status.active': 'Active',
    'service.status.paused': 'Paused',
    ...categoryLabelDrafts,
  });

  return (
    <ProviderServicesClient
      services={services.map((s) => ({
        id: s.id,
        categoryKey: s.categoryKey,
        title: s.title,
        description: s.description,
        priceModel: s.priceModel,
        basePriceThb: s.basePriceThb,
        durationMin: s.durationMin,
        advanceNoticeHours: s.advanceNoticeHours,
        status: s.status,
      }))}
      categories={categories.map((c) => ({
        key: c.key,
        label: labels[`services.category.${c.key}`] || c.key,
      }))}
      labels={labels}
    />
  );
}
