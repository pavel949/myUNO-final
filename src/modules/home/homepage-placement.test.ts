import { describe, expect, it } from 'vitest';
import { applyHomepagePlacements } from './homepage-placement';

const placements = [
  { id: 'p1', destinationKey: 'phuket', locale: null, sectionKey: 'projects', entityType: 'project', entityId: 'b', position: 1, visibleFrom: null, visibleUntil: null, status: 'active' },
  { id: 'p2', destinationKey: 'phuket', locale: 'ru', sectionKey: 'projects', entityType: 'project', entityId: 'a', position: 2, visibleFrom: null, visibleUntil: null, status: 'active' },
];

describe('homepage placement resolver', () => {
  it('orders only already-eligible entities and keeps canonical fallback', () => {
    expect(applyHomepagePlacements([{ id: 'a' }, { id: 'b' }, { id: 'c' }], placements, {
      destinationKey: 'phuket', locale: 'ru', sectionKey: 'projects', entityType: 'project',
    }).map((item) => item.id)).toEqual(['b', 'a', 'c']);
  });

  it('does not publish unknown IDs or locale-specific rows into another locale', () => {
    expect(applyHomepagePlacements([{ id: 'a' }, { id: 'c' }], placements, {
      destinationKey: 'phuket', locale: 'en', sectionKey: 'projects', entityType: 'project',
    }).map((item) => item.id)).toEqual(['a', 'c']);
  });
});
