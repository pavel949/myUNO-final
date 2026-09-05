import { getLabels } from '@/lib/i18n';
import AdminAttributionClient from './attribution-client';

export const dynamic = 'force-dynamic';

/**
 * Marketing attribution by source channel (doc 17 CRM, doc 13 analytics).
 * Wired to GET /api/admin/reports/attribution.
 */
export default async function AdminAttributionPage() {
  const labels = await getLabels({
    'admin.attribution.title': 'Channel attribution',
    'admin.attribution.subtitle':
      'CRM profiles grouped by acquisition channel — conversion rates to guest, buyer, and owner lifecycle stages.',
    'admin.attribution.loading': 'Loading attribution report…',
    'admin.attribution.empty': 'No attributed profiles yet.',
    'admin.attribution.error': 'Could not load attribution report.',
    'admin.attribution.summary_profiles': 'Total profiles',
    'admin.attribution.summary_channels': 'Active channels',
    'admin.attribution.col_channel': 'Channel',
    'admin.attribution.col_category': 'Category',
    'admin.attribution.col_profiles': 'Profiles',
    'admin.attribution.col_guests': 'Guests',
    'admin.attribution.col_buyers': 'Buyers',
    'admin.attribution.col_owners': 'Owners',
    'admin.attribution.col_conv_guest': '→ Guest %',
    'admin.attribution.col_conv_buyer': '→ Buyer %',
    'admin.attribution.col_conv_owner': '→ Owner %',
  });

  return (
    <div>
      <h1 className="text-heading-1 font-bold text-text-ink mb-8">
        {labels['admin.attribution.title']}
      </h1>
      <p className="text-body text-text-secondary mb-24 max-w-3xl">
        {labels['admin.attribution.subtitle']}
      </p>
      <AdminAttributionClient labels={labels} />
    </div>
  );
}
