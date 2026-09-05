import { getLabels } from '@/lib/i18n';
import AdminIncidentsClient from './incidents-client';

export const dynamic = 'force-dynamic';

/**
 * Cross-platform incident log (doc 08 §6, operational oversight).
 * Reads from GET /api/admin/incidents — unit-level maintenance, complaints, violations.
 */
export default async function AdminIncidentsPage() {
  const labels = await getLabels({
    'admin.incidents.title': 'Incidents',
    'admin.incidents.subtitle':
      'Maintenance issues, guest complaints, and policy violations across all units. Acknowledge and resolve from this board.',
    'admin.incidents.loading': 'Loading incidents…',
    'admin.incidents.empty': 'No incidents match this filter.',
    'admin.incidents.error': 'Could not load incidents.',
    'admin.incidents.filter_active': 'Active',
    'admin.incidents.filter_open': 'Open',
    'admin.incidents.filter_in_progress': 'In progress',
    'admin.incidents.filter_resolved': 'Resolved',
    'admin.incidents.col_unit': 'Unit',
    'admin.incidents.col_type': 'Type',
    'admin.incidents.col_severity': 'Severity',
    'admin.incidents.col_description': 'Description',
    'admin.incidents.col_status': 'Status',
    'admin.incidents.col_reported': 'Reported by',
    'admin.incidents.col_action': '',
    'admin.incidents.type.maintenance': 'Maintenance',
    'admin.incidents.type.complaint': 'Complaint',
    'admin.incidents.type.violation': 'Violation',
    'admin.incidents.severity.low': 'Low',
    'admin.incidents.severity.medium': 'Medium',
    'admin.incidents.severity.high': 'High',
    'admin.incidents.severity.critical': 'Critical',
    'admin.incidents.status.open': 'Open',
    'admin.incidents.status.acknowledged': 'Acknowledged',
    'admin.incidents.status.in_progress': 'In progress',
    'admin.incidents.status.resolved': 'Resolved',
    'admin.incidents.status.closed': 'Closed',
    'admin.incidents.action.acknowledged': 'Acknowledge',
    'admin.incidents.action.in_progress': 'Start work',
    'admin.incidents.action.resolved': 'Resolve',
    'admin.incidents.action.closed': 'Close',
  });

  return (
    <div>
      <h1 className="text-heading-1 font-bold text-text-ink mb-8">
        {labels['admin.incidents.title']}
      </h1>
      <p className="text-body text-text-secondary mb-24 max-w-3xl">
        {labels['admin.incidents.subtitle']}
      </p>
      <AdminIncidentsClient labels={labels} />
    </div>
  );
}
