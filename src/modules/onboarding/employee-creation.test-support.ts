import { vi } from 'vitest';
import { createEmployeeCreationService } from './employee-creation.service';
const now = new Date('2026-01-01T00:00:00Z');
export const requestId = '00000000-0000-4000-8000-000000000001';
export const nextRequestId = '00000000-0000-4000-8000-000000000002';
export function employeeHarness() {
  let state: any = {
    identities: [{ id: 'author', status: 'active', isAdmin: false }, { id: 'reviewer', status: 'active', isAdmin: true }, { id: 'other', status: 'active', isAdmin: false }],
    spaces: [{ id: 'space', name: 'Existing workspace', organizationId: 'org', status: 'active' }],
    members: [{ id: 'membership', operatingSpaceId: 'space', identityId: 'author', active: true, capabilities: ['create_unit', 'create_complex'] }],
    organizations: [{ id: 'org', status: 'active' }], attachments: [{ id: 'attachment', operatingSpaceId: 'space', unitId: 'attached', active: true, startsOn: now, endsOn: null }],
    units: [{ id: 'attached', projectId: 'project', name: 'A101', status: 'live', updatedAt: now, descriptionKey: null, marketingTitleKey: null, coverMediaId: null,
      bedrooms: 1, bathrooms: 1, maxGuests: 2, sizeSqm: 40, grossAreaSqm: null, floor: null, addressSupplement: '', amenityKeys: [] }],
    projects: [{ id: 'project', name: 'Existing project', status: 'live', updatedAt: now, descriptionKey: null, coverMediaId: null,
      brand: null, address: 'Existing address', city: null, district: null, projectType: 'condominium', totalUnits: null }],
    projectRoles: [{ id: 'operator', projectId: 'project', organizationId: 'org', roleKey: 'operator', provenance: 'verified', effectiveFrom: null, effectiveTo: null }],
    engagements: [], roles: [], rows: [], audits: [], assets: [], areas: [{ id: 'area', status: 'live' }],
    unitMedia: [], projectMedia: [], amenities: [], keys: [], translations: [],
  };
  const expand = (key: string, row: any): any => key === 'units' ? { ...row, project: expand('projects', state.projects.find((p: any) => p.id === row.projectId)),
    engagements: state.engagements.filter((e: any) => e.unitId === row.id) } : key === 'projects' ? { ...row, orgRoles: state.projectRoles.filter((r: any) => r.projectId === row?.id) } : row;
  const matches = (item: any, where: any = {}): boolean => Object.entries(where).every(([key, value]: [string, any]) => {
    if (key === 'AND') return value.every((entry: any) => matches(item, entry));
    if (key === 'OR') return value.some((entry: any) => matches(item, entry));
    if (key === 'NOT') return !matches(item, value);
    if (key.includes('_') && item[key] === undefined && typeof value === 'object') return matches(item, value);
    const actual = item[key];
    if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
      if ('path' in value) return value.path.reduce((v: any, part: string) => v?.[part], actual) === value.equals;
      if ('some' in value) return (actual ?? []).some((entry: any) => matches(entry, value.some));
      if ('in' in value) return value.in.includes(actual);
      if ('notIn' in value) return !value.notIn.includes(actual);
      if ('not' in value) return actual !== value.not;
      if ('hasSome' in value) return value.hasSome.some((entry: any) => actual?.includes(entry));
      if ('lte' in value) return actual <= value.lte;
      if ('gt' in value) return actual > value.gt;
      if ('equals' in value) return value.mode === 'insensitive' ? String(actual).toLowerCase() === value.equals.toLowerCase() : actual === value.equals;
      if ('contains' in value) return String(actual).toLowerCase().includes(value.contains.toLowerCase());
      return matches(actual ?? {}, value);
    }
    return actual === value;
  });
  const delegate = (key: string) => ({
    findUnique: vi.fn(async ({ where }: any) => { const row = state[key].find((item: any) => matches(expand(key, item), where)); return row ? expand(key, row) : null; }),
    findFirst: vi.fn(async ({ where }: any) => { const row = state[key].find((item: any) => matches(expand(key, item), where)); return row ? expand(key, row) : null; }),
    findMany: vi.fn(async ({ where = {}, take }: any = {}) => state[key].map((row: any) => expand(key, row)).filter((item: any) => matches(item, where)).slice(0, take)),
    count: vi.fn(async ({ where }: any) => state[key].filter((item: any) => matches(expand(key, item), where)).length),
    create: vi.fn(async ({ data }: any) => { const row = { id: `${key}-${state[key].length + 1}`, updatedAt: now, ...(key === 'rows' ? { unitId: null } : {}), ...structuredClone(data) }; state[key].push(row); return expand(key, row); }),
    createMany: vi.fn(async ({ data }: any) => { state[key].push(...structuredClone(data)); return { count: data.length }; }),
    update: vi.fn(async ({ where, data }: any) => { const row = state[key].find((item: any) => matches(item, where)); if (!row) throw { code: 'P2025' }; Object.assign(row, structuredClone(data)); return expand(key, row); }),
    deleteMany: vi.fn(async ({ where }: any) => { state[key] = state[key].filter((row: any) => !matches(row, where)); }),
    upsert: vi.fn(async ({ where, create, update }: any) => { const row = state[key].find((item: any) => matches(item, where));
      if (row) { Object.assign(row, structuredClone(update)); return row; } state[key].push(structuredClone(create)); return create; }),
  });
  const db: any = { identity: delegate('identities'), operatingSpace: delegate('spaces'), operatingSpaceMember: delegate('members'),
    operatingSpaceUnit: delegate('attachments'), organization: delegate('organizations'), unit: delegate('units'), project: delegate('projects'),
    projectOrganizationRole: delegate('projectRoles'), unitEngagement: delegate('engagements'), roleAssignment: delegate('roles'),
    crmOpportunity: delegate('rows'), auditLog: delegate('audits'), mediaAsset: delegate('assets'), area: delegate('areas'),
    unitMedia: delegate('unitMedia'), projectMedia: delegate('projectMedia'), projectAmenity: delegate('amenities'), contentKey: delegate('keys'), translation: delegate('translations'),
    commercialOffering: { upsert: vi.fn() },
    $queryRaw: vi.fn(async (parts: TemplateStringsArray, ...values: any[]) => {
      const sql = parts.join('?');
      if (sql.includes("NOT (requirements ? 'employeeCreation')")) return state.rows.filter((row: any) => row.identityId === values[0] && row.source === values[1] && !Object.prototype.hasOwnProperty.call(row.requirements, 'employeeCreation')).slice(0, 50).map((row: any) => ({ id: row.id }));
      if (sql.includes("requirements->'employeeCreation'->'requests'")) return state.rows.filter((row: any) => row.identityId === values[0] && row.source === values[1] && row.requirements?.employeeCreation?.requests?.some((request: any) => request.requestId === values[2])).map((row: any) => ({ id: row.id }));
      if (sql.includes('FROM role_assignment')) return state.roles.filter((role: any) => role.identityId === values[0] && role.scopeType === values[1] && role.projectId === values[2] && role.unitId === values[3] && role.status === 'active');
      if (sql.includes('AS content_key_alias')) return [{ content_key_alias: false }];
      return [];
    }),
    $transaction: vi.fn(async (run: any) => { const before = structuredClone(state); try { return await run(db); } catch (error) { state = before; throw error; } }),
  };
  const unitInput = (overrides: any = {}) => ({ requestId, spaceId: 'space', kind: 'unit', projectId: 'project', status: 'submitted',
    draft: { unitName: 'A102', bedrooms: 2, bathrooms: 2, maxGuests: 4 }, ...overrides });
  const complexInput = (overrides: any = {}) => ({ requestId, spaceId: 'space', kind: 'complex', projectId: null, status: 'submitted',
    draft: { proposedProject: 'New complex', projectAddress: 'New address', projectType: 'condominium', areaId: 'area', latitude: 7.8, longitude: 98.3 }, ...overrides });
  return { db, service: createEmployeeCreationService(db), state: () => state, unitInput, complexInput };
}
