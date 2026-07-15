import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';
import NewTicketClient from './new-ticket-client';

export const dynamic = 'force-dynamic';

export default async function NewTicketPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/tickets/new');
  }

  const labels = await getLabels({
    'tickets.new.title': 'Raise a request',
    'tickets.new.back': '← My requests',
    'tickets.new.category': 'Category',
    'tickets.new.category.maintenance': 'Maintenance',
    'tickets.new.category.housekeeping': 'Housekeeping',
    'tickets.new.category.complaint': 'Complaint',
    'tickets.new.category.billing_question': 'Billing question',
    'tickets.new.subject': 'Subject',
    'tickets.new.description': 'Describe the issue',
    'tickets.new.priority': 'Priority',
    'tickets.new.priority.normal': 'Normal',
    'tickets.new.priority.high': 'High',
    'tickets.new.priority.urgent': 'Urgent',
    'tickets.new.submit': 'Send request',
    'tickets.new.missing_context':
      'Open this form from your trip or unit so we know which home it concerns.',
    'tickets.new.error_generic': 'Could not send. Please try again.',
  });

  return (
    <Suspense>
      <NewTicketClient labels={labels} />
    </Suspense>
  );
}
