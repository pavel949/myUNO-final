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
  });

  return (
    <main className="min-h-screen bg-surface-background p-24 md:p-32">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-heading-1 font-bold text-text-ink mb-24">
          {labels['messages.inbox.title']}
        </h1>
        {threads.length === 0 ? (
          <div className="bg-surface-paper border border-border-line rounded-lg p-32 text-center">
            <p className="text-body text-text-secondary">
              {labels['messages.inbox.empty']}
            </p>
          </div>
        ) : (
          <div className="bg-surface-paper border border-border-line rounded-lg">
            {threads.map((thread) => (
              <Link
                key={thread.id}
                href={`/messages/${thread.id}`}
                className="flex items-center justify-between gap-12 p-16 border-b border-border-line last:border-b-0 hover:bg-surface-ivory transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-body font-semibold text-text-ink truncate">
                    {thread.others.map((o) => o.name).join(', ') || 'myUNO'}
                  </p>
                  {thread.lastMessage && (
                    <p className="text-small text-text-secondary truncate">
                      {thread.lastMessage}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-8 shrink-0">
                  {thread.unreadCount > 0 && (
                    <span className="min-w-24 h-24 px-8 rounded-full bg-brand-andaman text-surface-ivory text-small font-semibold flex items-center justify-center">
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
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
