import { getLabels } from '@/lib/i18n';
import ThreadClient from './thread-client';

export const dynamic = 'force-dynamic';

export default async function ThreadPage({ params }: { params: { threadId: string } }) {
  const labels = await getLabels({
    'messages.thread.back': '← Messages',
    'messages.thread.loading': 'Loading conversation…',
    'messages.thread.not_found': 'Conversation not found',
    'messages.thread.placeholder': 'Write a message…',
    'messages.thread.send': 'Send',
    'messages.thread.error_generic': 'Could not send. Please try again.',
  });

  return <ThreadClient threadId={params.threadId} labels={labels} />;
}
