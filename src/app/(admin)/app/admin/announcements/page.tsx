import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { listProjects } from '@/modules/projects';
import { AnnouncementsComposer } from '@/components/announcements/AnnouncementsComposer';

export const dynamic = 'force-dynamic';

/**
 * Announcements (doc 08 §6, doc 09 §3).
 *
 * The in-stay home space has always rendered announcements, and **nothing in
 * the product could write one**: `createAnnouncement` and
 * `publishAnnouncement` existed, were tested, and had no caller. A residence
 * could not tell its residents the water would be off.
 *
 * Two steps on purpose. Writing a draft is private; publishing notifies every
 * person in the audience across the project, so it is a separate, deliberate
 * act — and one that leaves an audit entry naming who sent it.
 */
export default async function AdminAnnouncementsPage({
  searchParams,
}: {
  searchParams: { projectId?: string };
}) {
  const projects = await listProjects();
  const projectId =
    searchParams.projectId && projects.some((p) => p.id === searchParams.projectId)
      ? searchParams.projectId
      : projects[0]?.id;

  const announcements = projectId
    ? await prisma.announcement.findMany({
        where: { projectId },
        include: {
          createdBy: { select: { firstName: true, lastName: true } },
          organization: { select: { name: true } },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take: 100,
      })
    : [];

  const labels = await getLabels({
    'admin.announcements.title': 'Announcements',
    'admin.announcements.subtitle':
      'A message to everyone in a project, or to one group inside it. Write it first, then publish — publishing notifies the audience.',
    'admin.announcements.project': 'Project',
    'admin.announcements.no_projects': 'Create a project first.',
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
    <div>
      <h1 className="font-display text-display-xl font-semibold text-text-ink mb-8">
        {labels['admin.announcements.title']}
      </h1>
      <p className="text-body text-text-secondary mb-24 max-w-3xl">
        {labels['admin.announcements.subtitle']}
      </p>

      {projectId ? (
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
          basePath="/app/admin/announcements"
        />
      ) : (
        <p className="text-body text-text-secondary">{labels['admin.announcements.no_projects']}</p>
      )}
    </div>
  );
}
