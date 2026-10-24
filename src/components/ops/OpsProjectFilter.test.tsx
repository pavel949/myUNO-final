import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import OpsProjectSwitcher from './OpsProjectSwitcher';

const labels = {
  'staff.ops.context.switcher': 'Контекст проекта',
  'staff.ops.context.all_projects': 'Все проекты',
};

// Navigation scope regression: this control must never discard the surrounding workspace.
describe('compact operations project filter', () => {
  it('keeps the active project visible while collapsing the long list', () => {
    const projects = Array.from({ length: 40 }, (_, i) => ({ id: `p${i}`, name: `Проект ${i}` }));
    const { container } = render(<OpsProjectSwitcher projects={projects} activeProjectId="p7" basePath="/ops/requests" labels={labels} />);
    const disclosure = container.querySelector('details')!;
    expect(disclosure.open).toBe(false);
    expect(container.querySelector('summary')).toHaveTextContent('Контекст проекта: Проект 7');
    fireEvent.click(container.querySelector('summary')!);
    expect(disclosure.open).toBe(true);
    expect(screen.getAllByRole('link')).toHaveLength(41);
    expect(screen.getByRole('link', { current: 'page' })).toHaveTextContent('Проект 7');
  });

  it('preserves department and space when selecting or clearing a project', () => {
    const projectId = 'project /?&=+#ไทย';
    const { container } = render(<OpsProjectSwitcher projects={[{ id: projectId, name: 'Layantara' }, { id: 'other', name: 'Other' }]} activeProjectId={null}
      basePath="/ops/stays?department=finance&spaceId=space-1" labels={labels} />);
    fireEvent.click(container.querySelector('summary')!);
    const project = new URL(screen.getByRole('link', { name: 'Layantara' }).getAttribute('href')!, 'https://myuno.test');
    expect(Array.from(project.searchParams.entries())).toEqual([
      ['department', 'finance'], ['spaceId', 'space-1'], ['projectId', projectId],
    ]);
    expect(screen.getByRole('link', { name: 'Все проекты' })).toHaveAttribute('href', '/ops/stays?department=finance&spaceId=space-1');
  });
});
