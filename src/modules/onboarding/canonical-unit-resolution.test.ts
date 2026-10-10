import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import { normalizeUnitIdentifier, resolveCanonicalUnitTx } from './canonical-onboarding';

function fixture(pages: { id: string; name: string }[][] = [[]]) {
  const findMany = vi.fn();
  for (const page of pages) findMany.mockResolvedValueOnce(page);
  const lock = vi.fn().mockResolvedValue([]);
  const findFirst = vi.fn();
  const tx = { $queryRaw: lock, unit: { findMany, findFirst } } as unknown as Prisma.TransactionClient;
  return { tx, lock, findMany, findFirst };
}

describe('canonical physical unit resolution', () => {
  it('retains non-Latin letters and meaningful combining marks', () => {
    expect(normalizeUnitIdentifier('Вилла А')).toBe('виллаа');
    expect(normalizeUnitIdentifier('บ้าน ก')).toBe('บ้านก');
    expect(normalizeUnitIdentifier('บ้าน ก')).not.toBe(normalizeUnitIdentifier('บ้าน ข'));
    expect(normalizeUnitIdentifier('Й1')).not.toBe(normalizeUnitIdentifier('И1'));
    expect(normalizeUnitIdentifier('é1')).toBe(normalizeUnitIdentifier('e\u03011'));
    expect(normalizeUnitIdentifier('é1')).not.toBe(normalizeUnitIdentifier('e1'));
    expect(normalizeUnitIdentifier('Unit Ｆ７０５')).toBe(normalizeUnitIdentifier('F-705'));
  });

  it.each(['Вилла А', 'บ้าน ก', 'Unit'])('detects repeated %s without an empty-key bypass', async (name) => {
    const { tx } = fixture([[{ id: 'existing', name }]]);
    await expect(resolveCanonicalUnitTx(tx, { projectId: 'p1', unitName: name }))
      .resolves.toEqual({ unitId: null, duplicateCandidateId: 'existing' });
  });

  it('locks the project before checking equivalent labels', async () => {
    const { tx, lock, findMany } = fixture([[{ id: 'existing', name: 'Building F / 705' }]]);
    await expect(resolveCanonicalUnitTx(tx, { projectId: 'p1', unitName: 'F-705' }))
      .resolves.toEqual({ unitId: null, duplicateCandidateId: 'existing' });
    expect(lock.mock.invocationCallOrder[0]).toBeLessThan(findMany.mock.invocationCallOrder[0]);
    expect(lock.mock.calls[0][1]).toBe('p1');
    expect(findMany.mock.calls[0][0].where).toEqual({ projectId: 'p1' });
  });

  it('checks beyond the first 500 units with stable bounded pagination', async () => {
    const firstPage = Array.from({ length: 500 }, (_, i) => ({ id: `u${i}`, name: `Other ${i}` }));
    const { tx, findMany } = fixture([firstPage, [{ id: 'match', name: 'F705' }]]);
    await expect(resolveCanonicalUnitTx(tx, { projectId: 'p1', unitName: 'Unit F 705' }))
      .resolves.toEqual({ unitId: null, duplicateCandidateId: 'match' });
    expect(findMany.mock.calls[1][0]).toMatchObject({ cursor: { id: 'u499' }, skip: 1, take: 500, orderBy: { id: 'asc' } });
  });

  it('allows distinct units and rejects blank names', async () => {
    const { tx } = fixture([[{ id: 'existing', name: 'บ้าน ก' }]]);
    await expect(resolveCanonicalUnitTx(tx, { projectId: 'p1', unitName: 'บ้าน ข' }))
      .resolves.toEqual({ unitId: null, duplicateCandidateId: null });
    await expect(resolveCanonicalUnitTx(tx, { projectId: 'p1', unitName: '  ' })).rejects.toThrow('Unit name is required');
  });

  it('reuses only an explicitly selected unit in the same project', async () => {
    const { tx, findFirst, findMany, lock } = fixture();
    findFirst.mockResolvedValueOnce({ id: 'existing' }).mockResolvedValueOnce(null);
    await expect(resolveCanonicalUnitTx(tx, { projectId: 'p1', existingUnitId: 'existing', unitName: 'F705' }))
      .resolves.toEqual({ unitId: 'existing', duplicateCandidateId: null });
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'existing', projectId: 'p1' }, select: { id: true } });
    await expect(resolveCanonicalUnitTx(tx, { projectId: 'p1', existingUnitId: 'foreign', unitName: 'F705' }))
      .rejects.toThrow('does not belong');
    expect(findMany).not.toHaveBeenCalled();
    expect(lock).not.toHaveBeenCalled();
  });
});
