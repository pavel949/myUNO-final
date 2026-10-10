import { describe, expect, it } from 'vitest';
import { PUBLIC_SLEEPING_SPACES_QUERY, publicSleepingSpaces } from './public-sleeping';

describe('public sleeping DTO allowlist', () => {
  it('selects only documentary room and bed fields', () => {
    expect(PUBLIC_SLEEPING_SPACES_QUERY.select).toEqual({ spaceType: true, sortOrder: true,
      beds: { orderBy: { bedType: 'asc' }, select: { bedType: true, count: true } } });
  });
  it('does not expose room names, IDs, notes or private access and never upgrades double to king', () => {
    const rows = [{ spaceType: 'bedroom', sortOrder: 2, name: 'Private name', id: 'private-id', notes: 'private-note', accessCode: 'private-code',
      beds: [{ id: 'private-bed', bedType: 'double', count: 1, notes: 'private-bed-note' }] }];
    expect(publicSleepingSpaces(rows)).toEqual([{ spaceType: 'bedroom', sortOrder: 2, beds: [{ bedType: 'double', count: 1 }] }]);
  });
  it('keeps canonical room order and positive integer counts only', () => {
    expect(publicSleepingSpaces([
      { spaceType: 'living_room', sortOrder: 2, beds: [{ bedType: 'sofa_bed', count: 1 }] },
      { spaceType: 'bedroom', sortOrder: 0, beds: [{ bedType: 'single', count: 2 }, { bedType: 'unknown', count: 1 }, { bedType: 'king', count: 0 }, { bedType: 'queen', count: 1.5 }] },
      { spaceType: 'private_access', sortOrder: 1, beds: [{ bedType: 'king', count: 1 }] },
    ])).toEqual([
      { spaceType: 'bedroom', sortOrder: 0, beds: [{ bedType: 'single', count: 2 }] },
      { spaceType: 'living_room', sortOrder: 2, beds: [{ bedType: 'sofa_bed', count: 1 }] },
    ]);
  });
  it('does not invent beds for empty or unsupported rooms', () => {
    expect(publicSleepingSpaces()).toEqual([]);
    expect(publicSleepingSpaces([{ spaceType: 'bedroom', sortOrder: 0, beds: [] }])).toEqual([]);
  });
});
