import { describe, expect, it } from 'vitest';
import { accessSatisfies, assignmentMatchesAuthorityResource } from './authority.service';

describe('canonical authority evaluator', () => {
  it('does not let a read grant satisfy a write requirement', () => {
    expect(accessSatisfies('read', 'read')).toBe(true);
    expect(accessSatisfies('allow', 'read')).toBe(true);
    expect(accessSatisfies('allow', 'allow')).toBe(true);
    expect(accessSatisfies('read', 'allow')).toBe(false);
  });

  it('enforces project and provider qualifiers together', () => {
    const assignment = {
      scopeType: 'project' as const,
      projectId: 'project-a',
      unitId: null,
      organizationId: null,
      providerId: 'provider-a',
    };

    expect(
      assignmentMatchesAuthorityResource(assignment as any, {
        projectId: 'project-a',
        providerId: 'provider-a',
      })
    ).toBe(true);

    expect(
      assignmentMatchesAuthorityResource(assignment as any, {
        projectId: 'project-a',
        providerId: 'provider-b',
      })
    ).toBe(false);
  });

  it('never lets unit scope bleed into another unit', () => {
    const assignment = {
      scopeType: 'unit' as const,
      projectId: 'project-a',
      unitId: 'unit-a',
      organizationId: null,
      providerId: null,
    };

    expect(
      assignmentMatchesAuthorityResource(assignment as any, {
        projectId: 'project-a',
        unitId: 'unit-b',
      })
    ).toBe(false);
  });
});
