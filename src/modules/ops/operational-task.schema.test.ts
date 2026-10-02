import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('OperationalTask schema relations', () => {
  const schema = readFileSync('prisma/schema.prisma', 'utf8');

  it('keeps the named assignee relation on Identity, not Unit', () => {
    const identity = schema.match(/model Identity \{[\s\S]*?\n\}/)?.[0] ?? '';
    const unit = schema.match(/model Unit \{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(identity).toContain(
      'operationalTasksAssigned OperationalTask[] @relation("operationalTaskAssignee")'
    );
    expect(unit).not.toContain('operationalTasksAssigned');
  });

  it('links OperationalTask to project, unit, booking and assignee', () => {
    const task = schema.match(/model OperationalTask \{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(task).toContain('project  Project');
    expect(task).toContain('unit     Unit');
    expect(task).toContain('booking  Booking?');
    expect(task).toContain('assignee Identity? @relation("operationalTaskAssignee"');
  });
});
