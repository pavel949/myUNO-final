import { describe, expect, it, vi } from 'vitest';
import { getPublicAmenityProjectBySlug } from './project-amenities.service';
const imported = vi.hoisted(() => vi.fn());
vi.mock('./public-managed-import', () => ({ managedImportedInventoryIds: imported }));
const project = (status: string) => ({ id: 'project', slug: 'complex', name: 'Complex', status, address: '' });
const db = (row: unknown) => ({ project: { findUnique: vi.fn().mockResolvedValue(row) } }) as never;
describe('amenities use existing project discovery eligibility', () => {
  it('allows live complexes', async () => expect(await getPublicAmenityProjectBySlug(db(project('live')), 'complex')).toEqual(project('live')));
  it('allows only proven managed-import drafts', async () => {
    imported.mockResolvedValue({ projectIds: ['project'], unitIds: [] });
    expect(await getPublicAmenityProjectBySlug(db(project('draft')), 'complex')).toEqual(project('draft'));
    imported.mockResolvedValue({ projectIds: ['other'], unitIds: [] });
    expect(await getPublicAmenityProjectBySlug(db(project('draft')), 'complex')).toBeNull();
  });
  it('never exposes archived or missing complexes', async () => {
    imported.mockResolvedValue({ projectIds: ['project'], unitIds: [] });
    expect(await getPublicAmenityProjectBySlug(db(project('archived')), 'complex')).toBeNull();
    expect(await getPublicAmenityProjectBySlug(db(null), 'complex')).toBeNull();
  });
});
