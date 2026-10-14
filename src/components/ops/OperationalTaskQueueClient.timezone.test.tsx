import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import OperationalTaskQueueClient from './OperationalTaskQueueClient';
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/components/LocaleProvider', () => ({ useLocale: () => 'en' }));
const task = {
  id: 'task', taskType: 'custom' as const, status: 'assigned' as const,
  dueAt: '2026-10-16T05:00:00.000Z', notes: null,
  project: { id: 'project', name: 'Estate' }, unit: { id: 'unit', name: 'Villa' }, assignee: null,
};
describe('operational task due-time display', () => {
  it('uses the selected operating-space zone', () => {
    render(<OperationalTaskQueueClient tasks={[task]} labels={{ 'staff.tasks.due': 'Due' }} timeZone="UTC" />);
    expect(screen.getByText(/Due.*05:00/)).toBeInTheDocument();
    expect(screen.queryByText(/Due.*12:00/)).not.toBeInTheDocument();
  });
  it('keeps the established default for the unscoped queue', () => {
    render(<OperationalTaskQueueClient tasks={[task]} labels={{ 'staff.tasks.due': 'Due' }} />);
    expect(screen.getByText(/Due.*12:00/)).toBeInTheDocument();
  });
});
