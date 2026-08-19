import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';
import { getPostableProjects } from '@/modules/comms';
import { AnnouncementsComposer } from '@/components/announcements/AnnouncementsComposer';

export const dynamic = 'force-dynamic';

/**
 * Announcements for the organisations that are entitled to make them.
 *
 * CLAUDE.md names three voices — myUNO, the management company, and the
 * juristic person — and the composer lived only inside the admin panel, which
 * two of the three cannot open. The API had always scoped them correctly, so a
 * management-company member could post and had no page to post from.
 *
 * Same composer as the admin panel, deliberately: the difference between these
 * posters is which projects they are handed and what the post is signed with,
 * not what writing one looks like.
 */

/**
 * An organisation addresses the people in its building. Only myUNO addresses
 * myUNO's own staff, so that audience is not offered here.
 */
const ORG_AUDIENCES = ['everyone', 'owners', 'residents', 'guests_in_stay'] as const;

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: { projectId?: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/announcements');
  }

  // An admin has the fuller board — cross-project oversight and org posts — so
  // send them there rather than showing them a thinner copy of it.
  if (user.isAdmin) {
    redirect('/app/admin/announcements');
  }

  const projects = await getPostableProjects(prisma, user.identityId, false);
  if (projects.length === 0) {
    redirect('/');
  }

  const projectId =
    searchParams.projectId && projects.some((p) => p.id === searchParams.projectId)
      ? searchParams.projectId
      : projects[0].id;

  const announcements = await prisma.announcement.findMany({
    where: { projectId },
    include: {
      createdBy: { select: { firstName: true, lastName: true } },
      organization: { select: { name: true } },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 100,
  });

  const labels = await getLabels({
    'admin.announcements.title': 'Announcements',
    'admin.announcements.subtitle':
      'A message to everyone in your building, or to one group inside it. Write it first, then publish — publishing notifies the audience.',
    'admin.announcements.project': 'Project',
    'admin.announcements.no_projects': 'You cannot post in any project yet.',
    'admin.announcements.compose': 'Write an announcement',
    'admin.announcements.headline': 'Title',
    'admin.announcements.body': 'Message',
    'admin.announcements.audience': 'Who should see this',
    'admin.announcements.audience.everyone': 'Everyone in the project',
    'admin.announcements.audience.owners': 'Owners',
    'admin.announcements.audience.residents': 'Residents',
    'admin.announcements.audience.guests_in_stay': 'Guests currently staying',
    'admin.announcements.audience.staff': 'Staff',
    'admin.announcements.pinned': 'Keep at the top',
    'admin.announcements.important': 'Important — also send by email',
    'admin.announcements.expires': 'Stop showing after',
    'admin.announcements.expires_hint': 'Leave empty to show it until you withdraw it.',
    'admin.announcements.save_draft': 'Save as draft',
    'admin.announcements.saving': 'Saving…',
    'admin.announcements.publish': 'Publish',
    'admin.announcements.publishing': 'Publishing…',
    'admin.announcements.publish_warning':
      'Publishing notifies everyone in the audience. It cannot be un-sent, only withdrawn.',
    'admin.announcements.unpublish': 'Withdraw',
    'admin.announcements.delete': 'Discard draft',
    'admin.announcements.status.draft': 'Draft',
    'admin.announcements.status.published': 'Published',
    'admin.announcements.status.unpublished': 'Withdrawn',
    'admin.announcements.posted_as': 'Signed',
    'admin.announcements.posted_as.myuno': 'as myUNO',
    'admin.announcements.posted_as.management_company': 'as the management company',
    'admin.announcements.posted_as.juristic_person': 'as the juristic person',
    'admin.announcements.posted_as_note':
      'How an announcement is signed follows from your role — it is not something you choose here.',
    'admin.announcements.empty': 'Nothing has been announced in this project yet.',
    'admin.announcements.error': 'That did not work.',
    'admin.announcements.expired': 'Expired',
  });

  return (
    <main className="min-h-screen bg-surface-background p-24 md:p-32">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-heading-1 font-bold text-text-ink mb-8">
          {labels['admin.announcements.title']}
        </h1>
        <p className="text-body text-text-secondary mb-24 max-w-3xl">
          {labels['admin.announcements.subtitle']}
        </p>

        <AnnouncementsComposer
          projectId={projectId}
          projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          announcements={announcements.map((a) => ({
            id: a.id,
            title: a.title,
            body: a.body,
            audience: a.audience,
            postedAs: a.postedAs,
            status: a.status,
            isPinned: a.isPinned,
            isImportant: a.isImportant,
            expiresAt: a.expiresAt ? a.expiresAt.toISOString() : null,
            createdAt: a.createdAt.toISOString(),
            author: `${a.createdBy.firstName} ${a.createdBy.lastName}`.trim(),
            organizationName: a.organization?.name ?? null,
          }))}
          labels={labels}
          basePath="/announcements"
          audiences={ORG_AUDIENCES}
        />
      </div>
    </main>
  );
}
