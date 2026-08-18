import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';
import {
  saveUnit,
  unsaveUnit,
  listSavedUnits,
  listSavedCollections,
  saveSearch,
  listSavedSearches,
  deleteSavedSearch,
  matchesSavedSearch,
  findSearchesMatching,
} from './saved.service';

/**
 * A prospect who browses and leaves had nothing to come back to: no way to keep
 * a villa they liked, no way to hear when a matching one appeared.
 */
describe('saving villas and searches', () => {
  let projectId: string;
  let unitId: string;
  let guestId: string;

  beforeEach(async () => {
    await resetDb();

    const project = await createProject();
    const unit = await createUnit({ projectId: project.id, status: 'live' });
    const guest = await createIdentity();

    projectId = project.id;
    unitId = unit.id;
    guestId = guest.id;
  });

  describe('keeping a villa', () => {
    it('saves it', async () => {
      const saved = await saveUnit(db, { identityId: guestId, unitId });

      expect(saved.unitId).toBe(unitId);
      expect(await listSavedUnits(db, guestId)).toHaveLength(1);
    });

    it('treats saving twice as the same intent, not an error', async () => {
      await saveUnit(db, { identityId: guestId, unitId });
      await saveUnit(db, { identityId: guestId, unitId });

      // Failing the guest for tapping a heart twice would be pedantry, and a
      // duplicate would show the villa twice in their list.
      expect(await listSavedUnits(db, guestId)).toHaveLength(1);
    });

    it('keeps the same villa in two different lists', async () => {
      await saveUnit(db, { identityId: guestId, unitId, collection: 'Songkran' });
      await saveUnit(db, { identityId: guestId, unitId, collection: 'New Year' });

      expect(await listSavedUnits(db, guestId)).toHaveLength(2);
      expect(await listSavedCollections(db, guestId)).toHaveLength(2);
    });

    it('removes a save, and shrugs at removing one that is not there', async () => {
      await saveUnit(db, { identityId: guestId, unitId });

      expect((await unsaveUnit(db, guestId, unitId)).removed).toBe(1);
      expect((await unsaveUnit(db, guestId, unitId)).removed).toBe(0);
      expect(await listSavedUnits(db, guestId)).toHaveLength(0);
    });

    it('leaves out a villa that is no longer bookable', async () => {
      await saveUnit(db, { identityId: guestId, unitId });
      await db.unit.update({ where: { id: unitId }, data: { status: 'offboarded' } });

      // A list that offers a villa nobody can book is worse than a shorter list.
      expect(await listSavedUnits(db, guestId)).toHaveLength(0);
    });

    it('keeps one person-s saves out of another-s', async () => {
      const other = await createIdentity();
      await saveUnit(db, { identityId: guestId, unitId });

      expect(await listSavedUnits(db, other.id)).toHaveLength(0);
    });

    it('records a note against the save, and updates it on re-save', async () => {
      await saveUnit(db, { identityId: guestId, unitId, note: 'Ask about the cot' });
      const again = await saveUnit(db, { identityId: guestId, unitId, note: 'Ask about pets' });

      expect(again.note).toBe('Ask about pets');
    });
  });

  describe('keeping a search', () => {
    it('saves and lists it', async () => {
      await saveSearch(db, {
        identityId: guestId,
        name: 'Three beds under 8k',
        criteria: { minBedrooms: 3, maxNightlyThb: 800_000 },
      });

      const searches = await listSavedSearches(db, guestId);
      expect(searches).toHaveLength(1);
      expect(searches[0].name).toBe('Three beds under 8k');
    });

    it('refuses to delete someone else-s', async () => {
      const other = await createIdentity();
      const search = await saveSearch(db, { identityId: guestId, criteria: {} });

      // Scoped in the delete, not fetched-then-checked.
      expect((await deleteSavedSearch(db, other.id, search.id)).removed).toBe(0);
      expect(await listSavedSearches(db, guestId)).toHaveLength(1);
    });

    it('deletes its owner-s own', async () => {
      const search = await saveSearch(db, { identityId: guestId, criteria: {} });

      expect((await deleteSavedSearch(db, guestId, search.id)).removed).toBe(1);
    });
  });

  describe('what counts as a match', () => {
    const villa = {
      projectId: 'p1',
      categoryKey: 'garden_villa',
      bedrooms: 3,
      maxGuests: 6,
      baseNightlyThb: 500_000,
      amenityKeys: ['pool', 'wifi'],
    };

    it('matches everything when nothing was asked for', () => {
      // An absent criterion is not a constraint. A search with no price ceiling
      // matches every price, rather than none.
      expect(matchesSavedSearch({}, villa)).toBe(true);
    });

    it('respects a bedroom floor', () => {
      expect(matchesSavedSearch({ minBedrooms: 3 }, villa)).toBe(true);
      expect(matchesSavedSearch({ minBedrooms: 4 }, villa)).toBe(false);
    });

    it('respects a price ceiling', () => {
      expect(matchesSavedSearch({ maxNightlyThb: 500_000 }, villa)).toBe(true);
      expect(matchesSavedSearch({ maxNightlyThb: 499_999 }, villa)).toBe(false);
    });

    it('respects a party size', () => {
      expect(matchesSavedSearch({ minGuests: 6 }, villa)).toBe(true);
      expect(matchesSavedSearch({ minGuests: 7 }, villa)).toBe(false);
    });

    it('requires every amenity asked for, not any of them', () => {
      // A guest who asked for a pool and a cot wants both; "any" would send them
      // a villa with neither of the two they cared about.
      expect(matchesSavedSearch({ amenityKeys: ['pool', 'wifi'] }, villa)).toBe(true);
      expect(matchesSavedSearch({ amenityKeys: ['pool', 'cot'] }, villa)).toBe(false);
    });

    it('respects project and category', () => {
      expect(matchesSavedSearch({ projectId: 'p2' }, villa)).toBe(false);
      expect(matchesSavedSearch({ categoryKey: 'beach_villa' }, villa)).toBe(false);
    });
  });

  describe('finding who to tell about a new villa', () => {
    it('returns the searches it matches, and skips those with alerts off', async () => {
      const wants = await saveSearch(db, {
        identityId: guestId,
        criteria: { minBedrooms: 2 },
      });
      const muted = await saveSearch(db, {
        identityId: guestId,
        criteria: { minBedrooms: 2 },
        alertsEnabled: false,
      });
      await saveSearch(db, {
        identityId: guestId,
        criteria: { minBedrooms: 9 },
      });

      const matched = await findSearchesMatching(db, {
        id: unitId,
        projectId,
        categoryKey: null,
        bedrooms: 3,
        maxGuests: 6,
        baseNightlyThb: 400_000,
        amenityKeys: [],
      });

      const ids = matched.map((m) => m.id);
      expect(ids).toContain(wants.id);
      expect(ids).not.toContain(muted.id);
      expect(matched).toHaveLength(1);
    });
  });
});
