import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { getCatalogKeys } from '@/modules/config';
import NewTicketClient from './new-ticket-client';

export const dynamic = 'force-dynamic';

export default async function NewTicketPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/tickets/new');
  }

  // The category list comes from the doc 04 §8 catalog, its labels from
  // catalog.ticket_categories.<key>.label (doc 05 §4) — no hardcoded taxonomy.
  const categories = await getCatalogKeys(prisma, 'catalog.ticket_categories').catch(() => [
    'maintenance',
    'housekeeping',
    'complaint',
    'billing_question',
    'access',
    'noise',
    'common_area',
    'other',
  ]);

  const labels = await getLabels({
    'tickets.new.title': 'Raise a request',
    'tickets.new.back': '← My requests',
    'tickets.new.category': 'Category',
    'catalog.ticket_categories.maintenance.label': 'Maintenance',
    'catalog.ticket_categories.housekeeping.label': 'Housekeeping',
    'catalog.ticket_categories.complaint.label': 'Complaint',
    'catalog.ticket_categories.billing_question.label': 'Billing question',
    'catalog.ticket_categories.access.label': 'Access & keys',
    'catalog.ticket_categories.noise.label': 'Noise',
    'catalog.ticket_categories.common_area.label': 'Common areas',
    'catalog.ticket_categories.other.label': 'Other',
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
      <NewTicketClient labels={labels} categories={categories} />
    </Suspense>
  );
}
