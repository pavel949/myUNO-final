import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity } from '@/test/util';
import {
  queryAuditLog,
  getAuditFacets,
  dayRangeToUtc,
  actionArea,
  AUDIT_PAGE_SIZE_MAX,
  SYSTEM_ACTOR,
} from './audit-query';

/**
 * Every privileged action wrote an audit row and nothing ever read one back.
 * These tests cover the read side — above all that paging never skips a row,
 * because in an audit trail a silently missing entry is worse than no trail.
 */
describe('reading the audit trail', () => {
  let actorId: string;

  const write = async (overrides: Record<string, unknown>) =>
    db.auditLog.create({
      data: {
        action: 'roles:grant',
        entityType: 'RoleAssignment',
        entityId: 'entity-1',
        actorIdentityId: actorId,
        at: new Date('2026-08-10T05:00:00Z'),
        ...overrides,
      },
    });

  beforeEach(async () => {
    await resetDb();
    const actor = await createIdentity({ firstName: 'Anna', lastName: 'Petrova' });
    actorId = actor.id;
  });

  it('returns entries newest first, with the actor named', async () => {
    await write({ at: new Date('2026-08-10T05:00:00Z'), action: 'roles:grant' });
    await write({ at: new Date('2026-08-12T05:00:00Z'), action: 'config:change' });

    const page = await queryAuditLog(db);

    expect(page.entries.map((e) => e.action)).toEqual(['config:change', 'roles:grant']);
    expect(page.entries[0].actorName).toBe('Anna Petrova');
    expect(page.total).toBe(2);
  });

  it('names no actor for an entry a scheduled job wrote', async () => {
    await write({ actorIdentityId: null, action: 'retention:purge' });

    const page = await queryAuditLog(db);
    expect(page.entries[0].actorName).toBeNull();
  });

  describe('paging', () => {
    beforeEach(async () => {
      // All in the same millisecond on purpose: this is what breaks an
      // `at`-only sort, and it is exactly what a burst of writes looks like.
      for (let i = 0; i < 25; i++) {
        await write({ entityId: `entity-${i}`, at: new Date('2026-08-10T05:00:00Z') });
      }
    });

    it('never repeats or skips a row across pages, even at identical timestamps', async () => {
      const first = await queryAuditLog(db, { page: 1, pageSize: 10 });
      const second = await queryAuditLog(db, { page: 2, pageSize: 10 });
      const third = await queryAuditLog(db, { page: 3, pageSize: 10 });

      const ids = [...first.entries, ...second.entries, ...third.entries].map((e) => e.id);
      expect(ids).toHaveLength(25);
      expect(new Set(ids).size).toBe(25);
    });

    it('reports how many pages there are', async () => {
      const page = await queryAuditLog(db, { pageSize: 10 });
      expect(page.total).toBe(25);
      expect(page.pageCount).toBe(3);
    });

    it('refuses to hand over the whole table to a hand-edited page size', async () => {
      const page = await queryAuditLog(db, { pageSize: 100_000 });
      expect(page.pageSize).toBe(AUDIT_PAGE_SIZE_MAX);
    });

    it('treats a nonsense page as the first one rather than failing', async () => {
      const page = await queryAuditLog(db, { page: -3, pageSize: 10 });
      expect(page.page).toBe(1);
      expect(page.entries).toHaveLength(10);
    });

    it('returns an empty page past the end without pretending there are none', async () => {
      const page = await queryAuditLog(db, { page: 99, pageSize: 10 });
      expect(page.entries).toEqual([]);
      expect(page.total).toBe(25);
    });
  });

  describe('filters', () => {
    beforeEach(async () => {
      await write({ action: 'roles:grant', entityType: 'RoleAssignment' });
      await write({ action: 'roles:revoke', entityType: 'RoleAssignment' });
      await write({ action: 'config:change', entityType: 'ConfigParameter' });
      await write({ action: 'retention:purge', entityType: 'Identity', actorIdentityId: null });
    });

    it('narrows to one exact action', async () => {
      const page = await queryAuditLog(db, { action: 'roles:grant' });
      expect(page.total).toBe(1);
    });

    it('narrows to a whole area when the filter ends in a colon', async () => {
      // "Show me everything roles-related" is how an auditor thinks; making
      // them pick grant and revoke separately invites missing one.
      const page = await queryAuditLog(db, { action: 'roles:' });
      expect(page.total).toBe(2);
      expect(page.entries.every((e) => e.action.startsWith('roles:'))).toBe(true);
    });

    it('narrows to an entity type', async () => {
      const page = await queryAuditLog(db, { entityType: 'ConfigParameter' });
      expect(page.total).toBe(1);
    });

    it('narrows to one person', async () => {
      const page = await queryAuditLog(db, { actor: actorId });
      expect(page.total).toBe(3);
    });

    it('narrows to the entries no person caused', async () => {
      const page = await queryAuditLog(db, { actor: SYSTEM_ACTOR });
      expect(page.total).toBe(1);
      expect(page.entries[0].action).toBe('retention:purge');
    });

    it('combines filters rather than picking one', async () => {
      const page = await queryAuditLog(db, { action: 'roles:', actor: actorId });
      expect(page.total).toBe(2);
    });
  });

  describe('the date range', () => {
    beforeEach(async () => {
      // 18 Aug 23:30 Phuket = 16:30 UTC. 19 Aug 06:30 Phuket = 18 Aug 23:30 UTC.
      await write({ at: new Date('2026-08-18T16:30:00Z'), entityId: 'late-on-the-18th' });
      await write({ at: new Date('2026-08-18T23:30:00Z'), entityId: 'early-on-the-19th' });
      // 19 Aug 23:00 Phuket = 16:00 UTC, still inside the Phuket day.
      await write({ at: new Date('2026-08-19T16:00:00Z'), entityId: 'late-on-the-19th' });
    });

    it('includes the whole of the last day, not just its first instant', async () => {
      const page = await queryAuditLog(db, { from: '2026-08-19', to: '2026-08-19' });

      // Both entries that fall on 19 August *in Phuket* — the one written at
      // 23:30 UTC on the 18th is already the 19th here.
      expect(page.entries.map((e) => e.entityId).sort()).toEqual([
        'early-on-the-19th',
        'late-on-the-19th',
      ]);
    });

    it('reads a day as a Phuket day, not a UTC one', async () => {
      const page = await queryAuditLog(db, { from: '2026-08-18', to: '2026-08-18' });
      expect(page.entries.map((e) => e.entityId)).toEqual(['late-on-the-18th']);
    });

    it('accepts an open-ended range', async () => {
      const from = await queryAuditLog(db, { from: '2026-08-19' });
      expect(from.total).toBe(2);

      const to = await queryAuditLog(db, { to: '2026-08-18' });
      expect(to.total).toBe(1);
    });

    it('ignores a malformed date instead of failing the page', async () => {
      // A hand-edited URL should show more than expected, never a 500 in the
      // middle of an audit.
      const page = await queryAuditLog(db, { from: 'yesterday', to: '2026-02-31' });
      expect(page.total).toBe(3);
    });
  });

  describe('the filter options', () => {
    it('come from what is in the table, with counts', async () => {
      await write({ action: 'roles:grant' });
      await write({ action: 'roles:grant' });
      await write({ action: 'config:change', entityType: 'ConfigParameter' });

      const facets = await getAuditFacets(db);

      expect(facets.actions).toEqual([
        { value: 'config:change', count: 1 },
        { value: 'roles:grant', count: 2 },
      ]);
      expect(facets.entityTypes.map((f) => f.value)).toEqual([
        'ConfigParameter',
        'RoleAssignment',
      ]);
    });

    it('are empty rather than invented when nothing has happened', async () => {
      const facets = await getAuditFacets(db);
      expect(facets.actions).toEqual([]);
    });
  });
});

describe('reading a Phuket day as UTC', () => {
  it('opens at 17:00 UTC the previous day', () => {
    // Thailand is UTC+7 all year — it has never observed daylight saving — so
    // the offset is exact rather than seasonal.
    const range = dayRangeToUtc('2026-08-19', '2026-08-19');
    expect(range.gte!.toISOString()).toBe('2026-08-18T17:00:00.000Z');
    expect(range.lt!.toISOString()).toBe('2026-08-19T17:00:00.000Z');
  });

  it('gives nothing back for a malformed or impossible date', () => {
    expect(dayRangeToUtc('19-08-2026', undefined)).toEqual({});
    expect(dayRangeToUtc('2026-02-31', undefined)).toEqual({});
    expect(dayRangeToUtc(undefined, undefined)).toEqual({});
  });
});

describe('the area of an action', () => {
  it('is the part before the colon', () => {
    expect(actionArea('roles:grant')).toBe('roles');
  });

  it('is nothing for an action that has no area', () => {
    expect(actionArea('signal_detected')).toBeNull();
  });
});
