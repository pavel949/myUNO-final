import Link from 'next/link';
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
    'admin.content.error_generic': 'Save failed. Please try again.',
  });

  return (
    <div>
      <h1 className="text-heading-1 font-bold text-text-ink mb-24">
        {labels['admin.content.title']}
      </h1>
      <div className="flex flex-wrap gap-8 mb-24">
        {namespaces.map((ns) => (
          <Link
            key={ns.namespace}
            href={`/app/admin/content?ns=${ns.namespace}`}
            className={`px-12 py-8 rounded-full text-small font-semibold border ${
              ns.namespace === activeNs
                ? 'bg-brand-andaman text-surface-ivory border-brand-andaman'
                : 'bg-surface-paper text-text-ink border-border-line hover:border-brand-andaman'
            }`}
          >
            {ns.namespace} ({ns._count.key})
          </Link>
        ))}
      </div>
      <ContentAdminClient
        keys={keys.map((k) => ({
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
