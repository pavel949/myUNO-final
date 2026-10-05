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
    expect(task).toMatch(/project\s+Project\s+@relation/);
    expect(task).toMatch(/unit\s+Unit\s+@relation/);
    expect(task).toMatch(/booking\s+Booking\?\s+@relation/);
    expect(task).toMatch(/assignee\s+Identity\?\s+@relation\("operationalTaskAssignee"/);
  });
});
