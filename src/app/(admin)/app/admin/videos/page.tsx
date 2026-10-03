import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import VideoAdminClient from './client';

export const dynamic = 'force-dynamic';

export default async function VideoAdminPage() {
  const [videos, labels] = await Promise.all([
    prisma.videoPublication.findMany({
      include: { mediaAsset: true },
      orderBy: { updatedAt: 'desc' },
    }),
    getLabels({
      'admin.video.kicker': 'MEDIA LIBRARY',
      'admin.video.title': 'Video Library',
      'admin.video.body': 'Publish only direct-play MP4/WebM assets with recorded provenance. Videos reuse canonical MediaAsset storage.',
      'admin.video.create': 'Create video draft',
      'admin.video.upload': 'Upload video',
      'admin.video.slug': 'Slug',
      'admin.video.locale': 'Locale',
      'admin.video.video_title': 'Title',
      'admin.video.description': 'Description',
      'admin.video.provenance': 'Provenance / source',
      'admin.video.recorded_on': 'Recorded on',
      'admin.video.scope_type': 'Scope type',
      'admin.video.scope_id': 'Scope ID',
      'admin.video.scope_none': 'Destination-wide',
      'admin.video.publish': 'Publish',
      'admin.video.archive': 'Archive',
      'admin.video.status': 'Status',
      'admin.video.empty': 'No video publications yet.',
      'admin.video.error': 'Action failed',
      'admin.video.scope_area': 'Area',
      'admin.video.scope_project': 'Project',
      'admin.video.scope_unit': 'Unit',
      'nav.locale.en': 'EN',
      'nav.locale.ru': 'RU',
      'nav.locale.th': 'TH',
      'nav.locale.zh': 'ZH',
    }),
  ]);

  return <VideoAdminClient
    videos={videos.map(video => ({
      id: video.id,
      slug: video.slug,
      locale: video.locale,
      title: video.title,
      description: video.description,
      provenance: video.provenance,
      status: video.status,
      mediaUrl: video.mediaAsset.storageKey,
      mimeType: video.mediaAsset.mimeType,
    }))}
    labels={labels}
  />;
}
