export type PublicResponsibilityScope = 'project' | 'selected_units' | 'unit' | 'none';

export interface PublicResponsibility {
  scope: PublicResponsibilityScope;
  organizationName: string | null;
  verified: boolean;
}

type ProjectRole = {
  roleKey: string;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  provenance: string | null;
  organization: { name: string; status: string };
};

type UnitEngagement = {
  status: string;
  mandateMediaId: string | null;
  startsOn: Date | null;
  endsOn: Date | null;
  managementOrg: { name: string; status: string } | null;
};

const PROJECT_OPERATOR_ROLES = new Set([
  'operator',
  'resort_operator',
  'management_operator',
  'property_manager',
]);

const effective = (from: Date | null, to: Date | null, now: Date) =>
  (!from || from <= now) && (!to || to > now);

export function resolveUnitResponsibility(
  engagements: UnitEngagement[],
  now: Date = new Date(),
): PublicResponsibility {
  const active = engagements.find((engagement) =>
    engagement.status === 'active' &&
    Boolean(engagement.mandateMediaId) &&
    engagement.managementOrg?.status === 'active' &&
    effective(engagement.startsOn, engagement.endsOn, now)
  );
  if (!active?.managementOrg) {
    return { scope: 'none', organizationName: null, verified: false };
  }
  return {
    scope: 'unit',
    organizationName: active.managementOrg.name,
    verified: true,
  };
}

export function resolveProjectResponsibility(
  projectRoles: ProjectRole[],
  managedUnits: Array<{ organizationName: string }>,
  publishedUnitCount: number,
  now: Date = new Date(),
): PublicResponsibility {
  const operator = projectRoles.find((role) =>
    PROJECT_OPERATOR_ROLES.has(role.roleKey) &&
    role.organization.status === 'active' &&
    role.provenance === 'verified' &&
    effective(role.effectiveFrom, role.effectiveTo, now)
  );
  if (operator) {
    return {
      scope: 'project',
      organizationName: operator.organization.name,
      verified: true,
    };
  }

  if (!managedUnits.length) {
    return { scope: 'none', organizationName: null, verified: false };
  }

  const counts = new Map<string, number>();
  for (const unit of managedUnits) {
    counts.set(unit.organizationName, (counts.get(unit.organizationName) ?? 0) + 1);
  }
  const [organizationName, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    scope: count === publishedUnitCount && publishedUnitCount > 0 ? 'selected_units' : 'selected_units',
    organizationName,
    verified: true,
  };
}
