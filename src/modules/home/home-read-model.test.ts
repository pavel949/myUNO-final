import { describe, expect, it } from 'vitest';
import { groupServicesBySituation, interleaveByProject, rankProjects } from './home-read-model';

describe('homepage read model', () => {
  it('ranks projects by real inventory facts, not by name', () => {
    const ranked = rankProjects([
      { id: 'a', name: 'Aaa', coverUrl: null, liveUnitCount: 40 },
      { id: 'b', name: 'Bbb', coverUrl: 'x', liveUnitCount: 2 },
      { id: 'c', name: 'Ccc', coverUrl: 'y', liveUnitCount: 9 },
    ]);
    expect(ranked.map((p) => p.id)).toEqual(['c', 'b', 'a']);
  });

  it('spreads units across projects and puts covered units first', () => {
    const units = [
      { id: '1', projectId: 'p1', coverUrl: null },
      { id: '2', projectId: 'p1', coverUrl: 'c' },
      { id: '3', projectId: 'p1', coverUrl: 'c' },
      { id: '4', projectId: 'p2', coverUrl: 'c' },
    ];
    expect(interleaveByProject(units, 3).map((u) => u.id)).toEqual(['2', '4', '3']);
  });

  it('groups catalogue services by situation and hides empty groups', () => {
    const groups = groupServicesBySituation([
      { id: '1', categoryKey: 'transfer' },
      { id: '2', categoryKey: 'cleaning' },
      { id: '3', categoryKey: 'cleaning' },
      { id: '4', categoryKey: 'cleaning' },
      { id: '5', categoryKey: 'emergency_medical' },
    ]);
    expect(groups.map((g) => g.key)).toEqual(['arrival', 'home']);
    expect(groups[1].items).toHaveLength(2);
  });
});
