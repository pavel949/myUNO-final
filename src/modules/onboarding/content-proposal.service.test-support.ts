import { vi } from 'vitest';
import { createContentProposalService } from './content-proposal.service';

export const mediaId = '11111111-1111-4111-8111-111111111111';
export const foreignMediaId = '22222222-2222-4222-8222-222222222222';
const now = new Date('2026-01-01T00:00:00Z');
export const fields = { name: 'D201', bedrooms: 1, bathrooms: 1, maxGuests: 2, sizeSqm: 41, grossAreaSqm: 42.75, floor: '2', addressSupplement: '', amenityKeys: [] };
export function harness() {
  let state: any = {
    identities: [{ id: 'author', status: 'active', isAdmin: false }, { id: 'other', status: 'active', isAdmin: false }, { id: 'admin', status: 'active', isAdmin: true }],
    roles: [{ id: 'grant', identityId: 'author', role: 'content_contributor', status: 'active', scopeType: 'unit', projectId: 'project', unitId: 'managed-legendary-d201', organizationId: null, providerId: null }],
    units: [{ id: 'managed-legendary-d201', projectId: 'project', project: { name: 'Legendary' }, ...fields,
      updatedAt: now, descriptionKey: 'unit.d201.description', marketingTitleKey: null, coverMediaId: mediaId, ownerIdentityId: 'other', baseNightlyThb: 990000, status: 'draft', assetStatus: 'managed' }],
    projects: [{ id: 'project', name: 'Legendary', updatedAt: now, descriptionKey: 'project.legendary.description', coverMediaId: null,
      brand: null, address: 'Phuket', city: null, district: null, projectType: 'condominium', facilities: [], totalUnits: null }],
    unitMedia: [{ unitId: 'managed-legendary-d201', mediaId, sort: 0 }], projectMedia: [],
    assets: [{ id: mediaId, storageKey: 'https://photos.example/current.jpg', kind: 'photo', encrypted: false,
      sizeBytes: 123, mimeType: 'image/jpeg', uploadedByIdentityId: 'other', updatedAt: now, deleteAfter: null },
    { id: foreignMediaId, storageKey: 'https://photos.example/foreign.jpg', kind: 'photo', encrypted: false,
      sizeBytes: 123, mimeType: 'image/jpeg', uploadedByIdentityId: 'other', updatedAt: now, deleteAfter: null }],
    keys: [{ id: 'content', key: 'unit.d201.description', namespace: 'unit', supportsRich: false, updatedAt: now }],
    translations: [{ id: 'translation-en', contentKeyId: 'content', locale: 'en', value: 'English original', status: 'ok', createdAt: now, updatedAt: now, updatedByIdentityId: 'other' },
      { id: 'translation-th', contentKeyId: 'content', locale: 'th', value: 'Thai original', status: 'ok', createdAt: now, updatedAt: now, updatedByIdentityId: 'other' }], rows: [], audit: [], areas: [],
  };
  const matches = (item: any, where: any = {}): boolean => Object.entries(where).every(([key, value]: [string, any]) => {
    if (key === 'OR') return value.some((v: any) => matches(item, v));
    if (value && typeof value === 'object') {
      if ('in' in value) return value.in.includes(item[key]);
      if ('notIn' in value) return !value.notIn.includes(item[key]);
      if ('not' in value) return item[key] !== value.not;
      return matches(item, value);
    }
    return item[key] === value;
  });
  const delegate = (key: string) => ({
    findUnique: vi.fn(async ({ where }: any) => state[key].find((item: any) => matches(item, where)) ?? null),
    findFirst: vi.fn(async ({ where }: any) => state[key].find((item: any) => matches(item, where)) ?? null),
    findMany: vi.fn(async ({ where, take }: any = {}) => state[key].filter((item: any) => matches(item, where)).slice(0, take)),
    count: vi.fn(async ({ where }: any) => state[key].filter((item: any) => matches(item, where)).length),
    create: vi.fn(async ({ data }: any) => { const item = { id: `${key}-${state[key].length + 1}`, updatedAt: new Date(), ...structuredClone(data) }; state[key].push(item); return item; }),
    update: vi.fn(async ({ where, data }: any) => { const item = state[key].find((row: any) => matches(row, where)); if (!item) throw { code: 'P2025' }; Object.assign(item, structuredClone(data)); return item; }),
    deleteMany: vi.fn(async ({ where }: any) => { state[key] = state[key].filter((item: any) => !matches(item, where)); }),
    upsert: vi.fn(async ({ where, create, update }: any) => { const condition = Object.values(where)[0]; const item = state[key].find((row: any) => matches(row, condition));
      if (item) { Object.assign(item, structuredClone(update)); return item; } const created = { id: `${key}-${state[key].length + 1}`, updatedAt: new Date(), ...structuredClone(create) }; state[key].push(created); return created; }),
  });
  const db: any = { identity: delegate('identities'), roleAssignment: delegate('roles'), unit: delegate('units'), project: delegate('projects'),
    unitMedia: delegate('unitMedia'), projectMedia: delegate('projectMedia'), mediaAsset: delegate('assets'), contentKey: delegate('keys'), translation: delegate('translations'),
    crmOpportunity: delegate('rows'), auditLog: delegate('audit'), area: delegate('areas'), $queryRaw: vi.fn(async (parts: TemplateStringsArray, ...values: any[]) => {
      const sql = parts.join('?');
      if (sql.includes('FROM role_assignment')) return state.roles.filter((role: any) => role.identityId === values[0] && role.scopeType === values[1] &&
        role.projectId === values[2] && role.unitId === values[3] && role.status === 'active' && role.role === 'content_contributor' && role.organizationId === null && role.providerId === null).map((role: any) => ({ id: role.id }));
      if (sql.includes('FROM media_asset')) return state.assets.filter((asset: any) => asset.id === values[0]).map((asset: any) => ({ id: asset.id }));
      return [];
    }),
    $transaction: async (run: any) => { const before = structuredClone(state); try { return await run(db); } catch (error) { state = before; throw error; } },
  };
  db.contentKey.findUnique = vi.fn(async ({ where }: any) => { const key = state.keys.find((item: any) => matches(item, where));
    return key ? { ...key, translations: state.translations.filter((t: any) => t.contentKeyId === key.id).sort((a: any,b: any) => a.locale.localeCompare(b.locale)) } : null; });
  db.contentKey.findUniqueOrThrow = async (args: any) => { const result = await db.contentKey.findUnique(args); if (!result) throw { code: 'P2025' }; return result; };
  const service = createContentProposalService(db);
  const payload = () => ({ facts: { ...fields, name: 'D201 improved' }, description: { locale: 'en', value: 'Reviewed English' }, gallery: { mediaIds: [mediaId], coverMediaId: mediaId } });
  const create = async (status = 'submitted', proposal = payload()) => {
    const target = await service.target('author', 'unit', 'managed-legendary-d201');
    return service.create('author', { scope: 'unit', targetId: target.target.id, baselineVersion: target.baselineVersion, proposal, status });
  };
  return { db, service, payload, create, state: () => state };
}

