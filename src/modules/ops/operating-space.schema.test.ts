import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Operating Space canonical scope', () => {
  const schema = readFileSync('prisma/schema.prisma', 'utf8');

  it('adds operating scope without replacing physical inventory', () => {
    expect(schema).toContain('model OperatingSpace {');
    expect(schema).toContain('model OperatingSpaceUnit {');
    expect(schema).toContain('unit           Unit');
    expect(schema).toContain('operatingSpaces OperatingSpaceUnit[]');
    expect(schema).toContain('model Project {');
    expect(schema).toContain('model Unit {');
    expect(schema).toContain('model Booking {');
  });

  it('allows one identity to belong to multiple operating spaces and teams', () => {
    const identity = schema.match(/model Identity \{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(identity).toContain('operatingSpaceMemberships OperatingSpaceMember[]');
    expect(identity).toContain('operatingTeamMemberships OperatingTeamMember[]');
  });

  it('stores exact unit access with operating-space provenance', () => {
    expect(schema).toContain('model OperatingSpaceMemberUnit {');
    expect(schema).toContain('@@unique([operatingSpaceId, identityId, unitId])');
    const unit = schema.match(/model Unit \{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(unit).toContain('operatingSpaceMemberAssignments OperatingSpaceMemberUnit[]');
  });

  it('keeps capabilities on operating-space membership', () => {
    const member = schema.match(/model OperatingSpaceMember \{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(member).toContain('capabilities     String[]');
    expect(member).toContain('@@unique([operatingSpaceId, identityId])');
  });
});
