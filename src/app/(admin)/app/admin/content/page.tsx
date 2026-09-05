import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import ContentAdminClient from './content-client';

export const dynamic = 'force-dynamic';

export default async function AdminContentPage({
  searchParams,
}: {
  searchParams: { ns?: string };
}) {
  const namespaces = await prisma.contentKey.groupBy({
    by: ['namespace'],
    _count: { key: true },
    orderBy: { namespace: 'asc' },
  });

  const activeNs = searchParams.ns || namespaces[0]?.namespace || '';
  const keys = activeNs
    ? await prisma.contentKey.findMany({
        where: { namespace: activeNs },
        include: { translations: true },
        orderBy: { key: 'asc' },
        take: 200,
      })
    : [];

  const labels = await getLabels({
    'admin.content.title': 'Content (RU / EN / TH)',
    'admin.content.save': 'Save',
    'admin.content.saved': 'Saved',
    'admin.content.loading': 'Loading keys…',
    'admin.content.error_generic': 'Save failed. Please try again.',
    'admin.content.export': 'Export CSV',
    'admin.content.import': 'Import CSV',
    'admin.content.export_error': 'Export failed.',
    'admin.content.import_error': 'Import failed.',
    'admin.content.import_success': 'Imported: {created} created, {updated} updated.',
    'admin.content.needs_review': 'review',
    'admin.content.preview_en': 'Preview EN (API)',
  });

  return (
    <div>
      <h1 className="font-display text-display-xl font-semibold text-text-ink mb-24">
        {labels['admin.content.title']}
      </h1>
      <ContentAdminClient
        namespaces={namespaces.map((ns) => ({
          namespace: ns.namespace,
          count: ns._count.key,
        }))}
        initialNamespace={activeNs}
        initialKeys={keys.map((k) => ({
          key: k.key,
          description: k.description,
          translations: Object.fromEntries(
            k.translations.map((t) => [t.locale, { value: t.value, status: t.status }])
          ),
        }))}
        labels={labels}
      />
    </div>
  );
}
