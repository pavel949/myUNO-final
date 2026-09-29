import { describe, expect, it } from 'vitest';
import { assertAcyclicStructureParent } from './structure-kinds';

const nodes = [
  { id: 'building', parentId: null },
  { id: 'wing', parentId: 'building' },
  { id: 'floor', parentId: 'wing' },
  { id: 'other', parentId: null },
];

describe('physical structure hierarchy safety', () => {
  it('allows reparenting a descendant under a separate project root node', () => {
    expect(() => assertAcyclicStructureParent(nodes, 'floor', 'other')).not.toThrow();
    expect(() => assertAcyclicStructureParent(nodes, 'wing', null)).not.toThrow();
  });

  it('rejects direct and indirect cycles', () => {
    expect(() => assertAcyclicStructureParent(nodes, 'building', 'building'))
      .toThrow(/cycle/);
    expect(() => assertAcyclicStructureParent(nodes, 'building', 'floor'))
      .toThrow(/cycle/);
    expect(() => assertAcyclicStructureParent(nodes, 'wing', 'floor'))
      .toThrow(/cycle/);
  });

  it('rejects a missing or cross-project parent and corrupt preexisting chains', () => {
    expect(() => assertAcyclicStructureParent(nodes, 'wing', 'foreign')).toThrow(/not found/);
    expect(() => assertAcyclicStructureParent([
      { id: 'a', parentId: 'b' }, { id: 'b', parentId: 'a' }, { id: 'child', parentId: null },
    ], 'child', 'a')).toThrow(/cycle/);
    expect(() => assertAcyclicStructureParent([
      { id: 'a', parentId: 'unknown' }, { id: 'child', parentId: null },
    ], 'child', 'a')).toThrow(/incomplete/);
  });
});
