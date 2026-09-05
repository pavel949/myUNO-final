import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getThreadsForIdentity, getUnreadCounts } from '@/modules/comms';
import { getLabels } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function MessagesInboxPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/messages');
  }

  const rawThreads = await getThreadsForIdentity(prisma, user.identityId);
  const unread = await getUnreadCounts(prisma, user.identityId);
  const otherIds = Array.from(
    new Set(
      rawThreads.flatMap((t) =>
        t.participants.map((p) => p.identityId).filter((id) => id !== user.identityId)
      )
    )
  );
  const identities = await prisma.identity.findMany({
    where: { id: { in: otherIds } },
    select: { id: true, firstName: true, lastName: true },
  });
  const nameById = new Map(identities.map((i) => [i.id, `${i.firstName} ${i.lastName}`]));
  const threads = rawThreads.map((t) => ({
    id: t.id,
    lastMessageAt: t.lastMessageAt,
    lastMessage: t.messages[0]?.body || null,
    unreadCount: unread[t.id] || 0,
    others: t.participants
      .filter((p) => p.identityId !== user.identityId)
      .map((p) => ({ id: p.identityId, name: nameById.get(p.identityId) || 'myUNO' })),
  }));

  const labels = await getLabels({
    'messages.inbox.title': 'Messages',
    'messages.inbox.empty':
      'No conversations yet. Message us from any of your trips and we will answer here.',
    'messages.inbox.empty_pane.lead': 'Select a conversation.',
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface-ivory">
      <div className="border-b border-border-line bg-surface-paper px-24 py-20 md:px-32">
        <h1 className="font-display text-display-xl font-semibold text-brand-deep">
          {labels['messages.inbox.title']}
        </h1>
      </div>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="w-full shrink-0 border-border-line md:w-[360px] md:border-r">
          {threads.length === 0 ? (
            <p className="px-24 py-32 text-body text-text-secondary">
              {labels['messages.inbox.empty']}
            </p>
          ) : (
            <ul>
              {threads.map((thread) => (
                <li key={thread.id} className="border-b border-border-line">
                  <Link
                    href={`/messages/${thread.id}`}
                    className="flex items-start justify-between gap-12 px-20 py-16 hover:bg-surface-paper"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-body font-medium text-text-ink">
                        {thread.others.map((o) => o.name).join(', ') || 'myUNO'}
                      </p>
                      {thread.lastMessage && (
                        <p className="mt-1 truncate text-small text-text-secondary">
                          {thread.lastMessage}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {thread.unreadCount > 0 && (
                        <span className="flex h-24 min-w-24 items-center justify-center rounded-full bg-brand-andaman px-8 text-small font-medium text-surface-ivory">
                          {thread.unreadCount}
                        </span>
                      )}
                      {thread.lastMessageAt && (
                        <span className="text-small text-text-stone">
                          {new Date(thread.lastMessageAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <section className="hidden flex-1 items-center justify-center bg-surface-ivory p-40 md:flex">
          <p className="max-w-sm text-center text-body text-text-secondary">
            {labels['messages.inbox.empty_pane.lead']}
          </p>
        </section>
      </div>
    </div>
  );
}
