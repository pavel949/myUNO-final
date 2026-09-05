import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import ComplianceChecklistsClient from './checklists-client';

export const dynamic = 'force-dynamic';

export default async function AdminComplianceChecklistsPage() {
  const units = await prisma.unit.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
    take: 500,
  });

  const labels = await getLabels({
    'admin.checklists.title': 'Compliance checklists',
    'admin.checklists.subtitle':
      'Recurring unit inspections — schedule from a template, record pass/fail, audit who checked.',
    'admin.checklists.loading': 'Loading checklists…',
    'admin.checklists.empty': 'No checklist instances scheduled.',
    'admin.checklists.error': 'Could not load checklists.',
    'admin.checklists.create_template': 'New template',
    'admin.checklists.template_name': 'Template name',
    'admin.checklists.create_submit': 'Create template',
    'admin.checklists.schedule_title': 'Schedule inspection',
    'admin.checklists.select_unit': 'Select unit…',
    'admin.checklists.select_template': 'Select template…',
    'admin.checklists.schedule_submit': 'Schedule',
    'admin.checklists.col_unit': 'Unit',
    'admin.checklists.col_template': 'Template',
    'admin.checklists.col_due': 'Due',
    'admin.checklists.col_result': 'Result',
    'admin.checklists.col_action': '',
    'admin.checklists.pending': 'Pending',
    'admin.checklists.passed': 'Passed',
    'admin.checklists.failed': 'Failed',
    'admin.checklists.mark_pass': 'Pass',
    'admin.checklists.mark_fail': 'Fail',
    'admin.checklists.default_item': 'Inspection complete',
    'admin.checklists.freq.weekly': 'Weekly',
    'admin.checklists.freq.monthly': 'Monthly',
    'admin.checklists.freq.quarterly': 'Quarterly',
    'admin.checklists.freq.annual': 'Annual',
  });

  return (
    <div>
      <h1 className="font-display text-display-xl font-semibold text-text-ink mb-8">
        {labels['admin.checklists.title']}
      </h1>
      <p className="text-body text-text-secondary mb-24 max-w-3xl">
        {labels['admin.checklists.subtitle']}
      </p>
      <ComplianceChecklistsClient labels={labels} units={units} />
    </div>
  );
}
