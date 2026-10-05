import { describe, expect, it } from 'vitest';
import { matchPlaces, normalizePlaceText, type PlaceOption } from './place-search';

const options: PlaceOption[] = [
  { kind: 'area', id: 'a1', slug: 'layan', name: 'Лаян' },
  { kind: 'area', id: 'a2', slug: 'bang-tao', name: 'Банг Тао' },
  { kind: 'project', id: 'p1', name: 'The Title Legendary', areaName: 'Rawai' },
  { kind: 'project', id: 'p2', name: 'Layantara Villa Resort', areaName: 'Лаян' },
  { kind: 'project', id: 'p3', name: 'Oceanstone', areaName: 'Банг Тао' },
];

describe('place search', () => {
  it('normalises Cyrillic, case, diacritics and a leading article', () => {
    expect(normalizePlaceText('The Title Legendary')).toBe('title legendari');
    expect(normalizePlaceText('Легендари')).toBe('legendari');
    expect(normalizePlaceText('Café-Bay')).toBe('cafe bai');
  });

  it('finds a complex from a short unique word', () => {
    expect(matchPlaces(options, 'Legendary')[0]).toMatchObject({ id: 'p1' });
  });

  it('reaches a Latin complex from a Cyrillic query and a Cyrillic area from a Latin one', () => {
    expect(matchPlaces(options, 'легендари')[0]).toMatchObject({ id: 'p1' });
    expect(matchPlaces(options, 'Layan')[0]).toMatchObject({ id: 'a1' });
    expect(matchPlaces(options, 'Layan').map((o) => o.id)).toContain('p2');
  });

  it('lists areas before complexes when the query is empty', () => {
    expect(matchPlaces(options, '').map((o) => o.kind)).toEqual(['area', 'area', 'project', 'project', 'project']);
  });

  it('returns nothing for an unknown place rather than guessing', () => {
    expect(matchPlaces(options, 'zzzz')).toEqual([]);
  });
});
