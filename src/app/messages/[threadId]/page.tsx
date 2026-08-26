import { Breadcrumb } from '@/components/Breadcrumb';
import { getLabels } from '@/lib/i18n';
import ThreadClient from './thread-client';

export const dynamic = 'force-dynamic';

export default async function ThreadPage({ params }: { params: { threadId: string } }) {
  const labels = await getLabels({
    'messages.breadcrumb_home': 'Home',
    'messages.breadcrumb_messages': 'Messages',
    'messages.breadcrumb_thread': 'Conversation',
    'messages.thread.back': '← Messages',
    'messages.thread.loading': 'Loading conversation…',
    'messages.thread.not_found': 'Conversation not found',
    'messages.thread.placeholder': 'Write a message…',
    'messages.thread.send': 'Send',
    'messages.thread.error_generic': 'Could not send. Please try again.',
  });

  const breadcrumbs = [
    { label: labels['messages.breadcrumb_home'], href: '/' },
    { label: labels['messages.breadcrumb_messages'], href: '/messages' },
    { label: labels['messages.breadcrumb_thread'], current: true },
  ];

  return (
    <>
      <Breadcrumb items={breadcrumbs} />
      <ThreadClient threadId={params.threadId} labels={labels} />
    </>
  );
}
