import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import ResearchAdminClient from './client';

export const dynamic = 'force-dynamic';

export default async function ResearchAdminPage() {
  const [publications, labels] = await Promise.all([
    prisma.researchPublication.findMany({
      include: {
        sources: { orderBy: { sourceNumber: 'asc' } },
        corrections: { orderBy: { publicAt: 'desc' } },
        author: { select: { firstName: true, lastName: true } },
        reviewer: { select: { firstName: true, lastName: true } },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    getLabels({
      'admin.research.kicker': 'PUBLIC KNOWLEDGE',
      'admin.research.title': 'Research & Index',
      'admin.research.body': 'Publish sourced market research only after independent review. Public corrections remain append-only.',
      'admin.research.create': 'Create draft',
      'admin.research.slug': 'Slug',
      'admin.research.locale': 'Locale',
      'admin.research.pub_title': 'Title',
      'admin.research.summary': 'Summary',
      'admin.research.article_body': 'Body',
      'admin.research.schedule': 'Scheduled publication',
      'admin.research.status': 'Status',
      'admin.research.sources': 'Sources',
      'admin.research.add_source': 'Add source',
      'admin.research.source_title': 'Source title',
      'admin.research.publisher': 'Publisher',
      'admin.research.url': 'Source URL',
      'admin.research.submit': 'Submit for review',
      'admin.research.review': 'Approve independent review',
      'admin.research.publish': 'Publish',
      'admin.research.retract': 'Retract',
      'admin.research.correction': 'Append correction',
      'admin.research.correction_summary': 'Correction summary',
      'admin.research.correction_detail': 'Correction detail',
      'admin.research.empty': 'No research publications yet.',
      'admin.research.error': 'Action failed',
    }),
  ]);

  return (
    <ResearchAdminClient
      publications={publications.map((publication) => ({
        id: publication.id,
        slug: publication.slug,
        locale: publication.locale,
        title: publication.title,
        summary: publication.summary,
        status: publication.status,
        authorName: `${publication.author.firstName} ${publication.author.lastName}`,
        reviewerName: publication.reviewer ? `${publication.reviewer.firstName} ${publication.reviewer.lastName}` : null,
        sources: publication.sources.map((source) => ({
          id: source.id,
          sourceNumber: source.sourceNumber,
          title: source.title,
          publisher: source.publisher,
          url: source.url,
        })),
        corrections: publication.corrections.map((correction) => ({
          id: correction.id,
          summary: correction.summary,
          publicAt: correction.publicAt.toISOString(),
        })),
      }))}
      labels={labels}
    />
  );
}
