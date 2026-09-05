import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import AdminProspectingClient from './prospecting-client';

export const dynamic = 'force-dynamic';

export default async function AdminProspectingPage() {
  const contacts = await prisma.identity.findMany({
    where: { status: { in: ['active', 'invited'] } },
    select: { id: true, firstName: true, lastName: true, email: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    take: 500,
  });

  const labels = await getLabels({
    'admin.prospecting.title': 'Prospecting accounts',
    'admin.prospecting.subtitle':
      'Owner-side outreach pipeline — track new contacts through first conversation to close.',
    'admin.prospecting.loading': 'Loading accounts…',
    'admin.prospecting.empty': 'No prospecting accounts match this filter.',
    'admin.prospecting.error': 'Could not load prospecting accounts.',
    'admin.prospecting.filter_active': 'Active',
    'admin.prospecting.filter_new': 'New',
    'admin.prospecting.filter_contacted': 'Contacted',
    'admin.prospecting.filter_interested': 'Interested',
    'admin.prospecting.filter_closed': 'Closed',
    'admin.prospecting.create_title': 'Add prospecting account',
    'admin.prospecting.create_submit': 'Create',
    'admin.prospecting.select_contact': 'Select contact…',
    'admin.prospecting.col_contact': 'Contact',
    'admin.prospecting.col_type': 'Account type',
    'admin.prospecting.col_status': 'Status',
    'admin.prospecting.col_reason': 'Reason',
    'admin.prospecting.col_close': 'Expected close',
    'admin.prospecting.col_action': '',
    'admin.prospecting.type.owner': 'Owner prospect',
    'admin.prospecting.type.developer': 'Developer',
    'admin.prospecting.type.institutional_partner': 'Institutional partner',
    'admin.prospecting.status.new': 'New',
    'admin.prospecting.status.contacted': 'Contacted',
    'admin.prospecting.status.interested': 'Interested',
    'admin.prospecting.status.pitched': 'Pitched',
    'admin.prospecting.status.closed': 'Closed',
    'admin.prospecting.action.contacted': 'Mark contacted',
    'admin.prospecting.action.interested': 'Mark interested',
    'admin.prospecting.action.pitched': 'Mark pitched',
    'admin.prospecting.action.closed': 'Close',
  });

  return (
    <div>
      <h1 className="font-display text-display-xl font-semibold text-text-ink mb-8">
        {labels['admin.prospecting.title']}
      </h1>
      <p className="text-body text-text-secondary mb-24 max-w-3xl">
        {labels['admin.prospecting.subtitle']}
      </p>
      <AdminProspectingClient
        labels={labels}
        contacts={contacts.map((c) => ({
          id: c.id,
          name: `${c.firstName} ${c.lastName}`.trim(),
          email: c.email,
        }))}
      />
    </div>
  );
}
