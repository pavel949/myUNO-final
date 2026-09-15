import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import { prisma } from '@/lib/prisma';
import { getConfig } from '@/modules/config';
import { getLabels } from '@/lib/i18n';
import { redirect } from 'next/navigation';
import ServicesAdminClient from './services-client';
import CreateServiceForm from './create-service-form';

export const dynamic = 'force-dynamic';

export default async function AdminServicesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const identity = await prisma.identity.findUnique({
    where: { id: user.identityId },
  });
  if (!identity) redirect('/');

  if (
    !(await can({
      identity,
      action: 'admin:view_all',
      resource: { resourceType: 'platform' },
    }))
  ) {
    redirect('/');
  }

  const [services, providers, catalog] = await Promise.all([
    /*
     * Every service, not only the ones awaiting a decision. The screen used to
     * ask for `status: 'draft'`, so a service vanished from the admin the
     * moment it was approved: the team could add one and approve it, and then
     * had nowhere to see it, let alone correct a description. Drafts still
     * come first — they are the ones waiting on a person.
     */
    prisma.service.findMany({
      include: {
        provider: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    }),
    prisma.provider.findMany({
      where: { status: 'active' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    getConfig(prisma, 'catalog.service_categories') as Promise<{ key: string }[] | null>,
  ]);
  const categories = catalog ?? [];

  const categoryLabelDrafts = Object.fromEntries(
    categories.map((c) => [`services.category.${c.key}`, c.key])
  );

  const labels: Record<string, string> = await getLabels({
    'admin.services.title': 'Service Submissions',
    'admin.services.empty': 'No pending submissions.',
    'admin.services.approve': 'Approve',
    'admin.services.reject': 'Reject',
    'admin.services.status_draft': 'Draft',
    'admin.services.status_vetted': 'Approved',
    'admin.services.status_rejected': 'Rejected',
    'admin.services.reason_placeholder': 'Rejection reason',
    'admin.services.error_generic': 'Action failed. Please try again.',
    'admin.services.create_title': 'Add a service',
    'admin.services.create_subtitle':
      'Add a service directly on behalf of an existing, vetted provider. It goes live immediately — no separate approval step.',
    'admin.services.field_provider': 'Provider',
    'admin.services.provider_empty': 'No active, vetted providers yet.',
    'admin.services.field_category': 'Category',
    'admin.services.field_title_en': 'Title (English)',
    'admin.services.field_title_ru': 'Title (Russian)',
    'admin.services.field_title_th': 'Title (Thai, optional)',
    'admin.services.field_description_en': 'Description (English)',
    'admin.services.field_description_ru': 'Description (Russian)',
    'admin.services.field_description_th': 'Description (Thai, optional)',
    'admin.services.field_price_model': 'Price model',
    'admin.services.field_price': 'Price (THB)',
    'admin.services.field_duration': 'Duration (minutes)',
    'admin.services.field_notice': 'Advance notice (hours)',
    'admin.services.price_model.fixed': 'Fixed price',
    'admin.services.price_model.per_hour': 'Per hour',
    'admin.services.price_model.per_person': 'Per person',
    'admin.services.price_model.quote': 'Individual quote',
    'admin.services.create_submit': 'Add service',
    'admin.services.create_working': 'Adding…',
    'admin.services.create_success': 'Service added and live on the marketplace.',
    'admin.services.status_active': 'Live',
    'admin.services.status_paused': 'Paused',
    'admin.services.edit': 'Edit',
    'admin.services.edit_cancel': 'Cancel',
    'admin.services.edit_save': 'Save changes',
    'admin.services.edit_saving': 'Saving…',
    'admin.services.pause': 'Pause',
    'admin.services.activate': 'Put live',
    'admin.services.filter_all': 'All',
    'admin.services.filter_draft': 'Awaiting approval',
    'admin.services.filter_active': 'Live',
    'admin.services.filter_paused': 'Paused',
    'admin.services.locked_hint':
      'A live service keeps the price it was approved on. Pause it to change price, duration or notice.',
    'admin.services.count': '{count} services',
    ...categoryLabelDrafts,
  });

  return (
    <div>
      <h1 className="font-display text-display-xl font-semibold text-text-ink mb-24">
        {labels['admin.services.title']}
      </h1>
      <CreateServiceForm
        providers={providers}
        categories={categories.map((c) => ({
          key: c.key,
          label: labels[`services.category.${c.key}`] || c.key,
        }))}
        labels={labels}
      />
      <ServicesAdminClient
        services={services.map((s) => ({
          id: s.id,
          title: s.title,
          providerName: s.provider?.name || '—',
          status: s.status,
          categoryKey: s.categoryKey,
          priceModel: s.priceModel,
          // Satang, as stored. The form converts for the field and back on
          // save — the one conversion pair, at the edge (CLAUDE.md money).
          basePriceThb: s.basePriceThb,
          durationMin: s.durationMin,
          advanceNoticeHours: s.advanceNoticeHours,
          titleEn: s.titleEn,
          titleRu: s.titleRu,
          titleTh: s.titleTh,
          descriptionEn: s.descriptionEn,
          descriptionRu: s.descriptionRu,
          descriptionTh: s.descriptionTh,
          createdAt: s.createdAt.toISOString(),
        }))}
        labels={labels}
      />
    </div>
  );
}
