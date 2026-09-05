import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { getProjectTickets } from '@/modules/comms';
import { Chip } from '@/components/Chip';
import { JuristicProjectSelect } from './project-select';

export const dynamic = 'force-dynamic';

/**
 * The juristic person's board (doc 03, doc 09 §3).
 *
 * A juristic member had no surface at all. CLAUDE.md names the juristic person
 * as one of the three voices entitled to address a building, and there was
 * nowhere for them to stand: no announcements, no view of what residents were
 * reporting, nothing.
 *
 * Deliberately narrow. A juristic person governs the common property — it is
 * not a management company and does not operate anyone's unit — so this shows
 * what is happening in the building and lets them speak to it, and stops there.
 * Widening it is a permissions decision (doc 03), not a layout one.
 */
function ticketChipStatus(
  status: string
): 'requested' | 'checked_in' | 'confirmed' | 'closed' | 'default' {
  switch (status) {
    case 'open':
    case 'waiting_reporter':
      return 'requested';
    case 'acknowledged':
    case 'in_progress':
      return 'checked_in';
    case 'resolved':
      return 'confirmed';
    case 'closed':
    case 'cancelled':
      return 'closed';
    default:
      return 'default';
  }
}

const chipStatusVariant = 'status' as const;

function ticketStatusLabel(status: string, labels: Record<string, string>): string {
  return labels[`tickets.status.${status}`] || status;
}

export default async function JuristicPortalPage({
  searchParams,
}: {
  searchParams: { projectId?: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/juristic');
  }

  const memberships = user.roles.filter(
    (role) => role.role === 'juristic_member' && role.projectId
  );
  if (memberships.length === 0 && !user.isAdmin) {
    redirect('/');
  }

  const projectIds = memberships.map((m) => m.projectId as string);
  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const locale = getRequestLocale();

  const labels = await getLabels({
    'juristic.title': 'Juristic person',
    'juristic.subtitle':
      'The common property of your building: what residents are reporting, and what you have told them.',
    'juristic.no_project': 'You are not registered against a building yet.',
    'juristic.project': 'Building',
    'juristic.announcements': 'Announcements',
    'juristic.announcements_write': 'Write an announcement',
    'juristic.announcements_empty': 'You have not published anything yet.',
    'juristic.published_on': 'Published',
    'juristic.published': 'Published',
    'juristic.draft': 'Draft',
    'juristic.draft_note': 'Not yet visible to residents',
    'juristic.tickets': 'Reported in this building',
    'juristic.tickets_empty': 'Nothing is open right now.',
    'juristic.tickets_note':
      'Reports raised by residents and owners in this building. Operations resolve them; this is so you can see them.',
    'juristic.raised_by': 'Raised by',
    'juristic.open_count': 'open',
    'juristic.messages': 'Messages',
    'tickets.status.open': 'Open',
    'tickets.status.acknowledged': 'Acknowledged',
    'tickets.status.in_progress': 'In progress',
    'tickets.status.waiting_reporter': 'Waiting for you',
    'tickets.status.resolved': 'Resolved',
    'tickets.status.closed': 'Closed',
    'tickets.status.cancelled': 'Cancelled',
  });

  const publishedChip = 'confirmed' as const;
  const draftChip = 'closed' as const;

  if (projects.length === 0) {
    return (
      <main className="min-h-screen bg-surface-ivory p-24 md:p-32">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-display text-display-xl font-semibold text-text-ink mb-16">
            {labels['juristic.title']}
          </h1>
          <p className="text-body text-text-stone">{labels['juristic.no_project']}</p>
        </div>
      </main>
    );
  }

  const projectId =
    searchParams.projectId && projects.some((p) => p.id === searchParams.projectId)
      ? searchParams.projectId
      : projects[0].id;

  const [announcements, tickets] = await Promise.all([
    prisma.announcement.findMany({
      where: { projectId, postedAs: 'juristic_person' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, title: true, body: true, status: true, createdAt: true },
    }),
    getProjectTickets(prisma, projectId, user.identityId),
  ]);

  const openTickets = tickets.filter(
    (ticket: { status: string }) =>
      !['resolved', 'closed', 'cancelled'].includes(ticket.status)
  );

  return (
    <main className="min-h-screen bg-surface-ivory p-24 md:p-32">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-display text-display-xl font-semibold text-text-ink mb-8">
          {labels['juristic.title']}
        </h1>
        <p className="text-body text-text-stone mb-24">{labels['juristic.subtitle']}</p>

        {projects.length > 1 ? (
          <JuristicProjectSelect
            label={labels['juristic.project']}
            projectId={projectId}
            projects={projects}
          />
        ) : (
          <p className="text-small text-text-stone mb-24">
            {labels['juristic.project']}: {projects[0].name}
          </p>
        )}

        <section className="mb-32">
          <div className="flex items-baseline justify-between mb-12">
            <h2 className="font-display text-title font-semibold text-text-ink m-0">
              {labels['juristic.announcements']}
            </h2>
            <Link
              href={`/announcements?projectId=${projectId}`}
              className="text-small text-brand-andaman font-semibold hover:underline"
            >
              {labels['juristic.announcements_write']}
            </Link>
          </div>

          {announcements.length === 0 ? (
            <p className="text-body text-text-stone">
              {labels['juristic.announcements_empty']}
            </p>
          ) : (
            <ul className="flex flex-col gap-12">
              {announcements.map((announcement) => {
                const isPublished = announcement.status === 'published';
                return (
                  <li
                    key={announcement.id}
                    className="p-16 bg-surface-paper border border-border-line rounded-lg"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-8 mb-4">
                      <p className="text-body font-semibold text-text-ink m-0">
                        {announcement.title}
                      </p>
                      <Chip variant={chipStatusVariant} status={isPublished ? publishedChip : draftChip}>
                        {isPublished ? labels['juristic.published'] : labels['juristic.draft']}
                      </Chip>
                    </div>
                    <p className="text-small text-text-stone whitespace-pre-wrap mb-8">
                      {announcement.body}
                    </p>
                    <p className="text-small text-text-stone m-0">
                      {isPublished
                        ? `${labels['juristic.published_on']} ${announcement.createdAt.toLocaleDateString(locale)}`
                        : `${announcement.createdAt.toLocaleDateString(locale)} · ${labels['juristic.draft_note']}`}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <h2 className="font-display text-title font-semibold text-text-ink mb-4">
            {`${labels['juristic.tickets']} · ${openTickets.length} ${labels['juristic.open_count']}`}
          </h2>
          <p className="text-small text-text-stone mb-12">{labels['juristic.tickets_note']}</p>

          {openTickets.length === 0 ? (
            <p className="text-body text-text-stone">{labels['juristic.tickets_empty']}</p>
          ) : (
            <ul className="flex flex-col gap-8">
              {openTickets.map(
                (ticket: {
                  id: string;
                  title: string;
                  status: string;
                  createdAt: Date;
                  raisedBy: { firstName: string; lastName: string } | null;
                }) => (
                  <li
                    key={ticket.id}
                    className="p-16 bg-surface-paper border border-border-line rounded-lg flex items-center justify-between gap-12"
                  >
                    <div>
                      <p className="text-body font-semibold text-text-ink m-0">{ticket.title}</p>
                      <p className="text-small text-text-stone m-0">
                        {`${labels['juristic.raised_by']} ${
                          ticket.raisedBy
                            ? `${ticket.raisedBy.firstName} ${ticket.raisedBy.lastName}`.trim()
                            : '—'
                        } · ${ticket.createdAt.toLocaleDateString(locale)}`}
                      </p>
                    </div>
                    <Chip
                      variant={chipStatusVariant}
                      status={ticketChipStatus(ticket.status)}
                    >
                      {ticketStatusLabel(ticket.status, labels as Record<string, string>)}
                    </Chip>
                  </li>
                )
              )}
            </ul>
          )}
        </section>

        <p className="mt-24">
          <Link
            href="/messages"
            className="inline-flex items-center h-40 px-16 rounded-md border border-border-line bg-surface-paper text-small font-medium text-text-ink"
          >
            {labels['juristic.messages']}
          </Link>
        </p>
      </div>
    </main>
  );
}
