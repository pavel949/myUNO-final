import { describe, it, expect, beforeEach } from 'vitest';
import {
  db,
  resetDb,
  createIdentity,
  createProject,
  createUnit,
  createBooking,
} from '@/test/util';
import { encryptGuestPii, safeDecrypt, isEncrypted } from './guest-pii';
import { capturePassportData, decryptPassportNumber } from './verification.service';
import { scrubExpiredPassportData } from '@/modules/core';
import { seedConfig } from '@/modules/config';
import {
  registerIntegrationAccount,
  getIntegrationAccount,
  getDecryptedConfig,
} from '@/modules/integrations';

describe('Guest PII encryption (doc 02 §3.2 🔒, doc 12)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('encrypts full name and date of birth, round-trips through safeDecrypt', () => {
    const encrypted = encryptGuestPii({
      fullName: 'Ivan Petrov',
      dateOfBirth: '1985-03-12',
    });

    expect(encrypted.fullName).not.toBe('Ivan Petrov');
    expect(isEncrypted(encrypted.fullName)).toBe(true);
    expect(isEncrypted(encrypted.dateOfBirth!)).toBe(true);
    expect(safeDecrypt(encrypted.fullName)).toBe('Ivan Petrov');
    expect(safeDecrypt(encrypted.dateOfBirth)).toBe('1985-03-12');
  });

  it('safeDecrypt passes legacy plaintext through unchanged', () => {
    expect(safeDecrypt('Plain Name')).toBe('Plain Name');
    expect(safeDecrypt(null)).toBeNull();
    expect(safeDecrypt('')).toBe('');
  });

  it('stores only ciphertext at rest for a captured guest', async () => {
    const guestIdentity = await createIdentity();
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({ projectId: project.id, status: 'live' });
    const booking = await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guestIdentity.id,
      status: 'confirmed',
    });

    const encrypted = encryptGuestPii({ fullName: 'Anna Sokolova', dateOfBirth: '1990-07-01' });
    const guest = await db.bookingGuest.create({
      data: {
        bookingId: booking.id,
        fullName: encrypted.fullName,
        nationality: 'RU',
        passportNumber: '',
        dateOfBirth: encrypted.dateOfBirth,
      },
    });
    await capturePassportData(db, {
      bookingGuestId: guest.id,
      passportNumber: 'AB1234567',
    });

    const raw = await db.bookingGuest.findUnique({ where: { id: guest.id } });
    expect(raw!.fullName).not.toContain('Anna');
    expect(raw!.passportNumber).not.toContain('AB1234567');
    expect(raw!.dateOfBirth).not.toContain('1990');
    // Nationality stays queryable plaintext (TM30 SQL predicate)
    expect(raw!.nationality).toBe('RU');

    expect(safeDecrypt(raw!.fullName)).toBe('Anna Sokolova');
    expect(decryptPassportNumber(raw!.passportNumber)).toBe('AB1234567');
  });
});

describe('Passport retention scrub (retention.passport_media_days_after_checkout)', () => {
  beforeEach(async () => {
    await resetDb();
    await seedConfig(db);
  });

  async function makeCheckedOutGuest(checkedOutDaysAgo: number) {
    const guestIdentity = await createIdentity();
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({ projectId: project.id, status: 'live' });
    const booking = await createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guestIdentity.id,
      status: 'checked_out',
    });
    await db.booking.update({
      where: { id: booking.id },
      data: {
        checkedOutAt: new Date(Date.now() - checkedOutDaysAgo * 24 * 60 * 60 * 1000),
      },
    });
    const encrypted = encryptGuestPii({ fullName: 'Guest Name', dateOfBirth: '1980-01-01' });
    return db.bookingGuest.create({
      data: {
        bookingId: booking.id,
        fullName: encrypted.fullName,
        nationality: 'DE',
        passportNumber: 'ciphertext-here',
        dateOfBirth: encrypted.dateOfBirth,
      },
    });
  }

  it('clears passport data for stays checked out past the retention window', async () => {
    const oldGuest = await makeCheckedOutGuest(400);
    const recentGuest = await makeCheckedOutGuest(1);

    const result = await scrubExpiredPassportData(db);
    expect(result.scrubbedGuests).toBe(1);

    const scrubbed = await db.bookingGuest.findUnique({ where: { id: oldGuest.id } });
    expect(scrubbed!.passportNumber).toBe('');
    expect(scrubbed!.dateOfBirth).toBeNull();

    const kept = await db.bookingGuest.findUnique({ where: { id: recentGuest.id } });
    expect(kept!.passportNumber).not.toBe('');
    expect(kept!.dateOfBirth).not.toBeNull();
  });
});

describe('Integration account config encryption (doc 12)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('stores the config as ciphertext and decrypts through the seam', async () => {
    const account = await registerIntegrationAccount(db, 'ical_airbnb', 'platform', {
      url: 'https://airbnb.example/ical/secret-token-123',
    });

    // At rest: a single encrypted string, no secrets visible
    const raw = await db.integrationAccount.findUnique({ where: { id: account.id } });
    expect(typeof raw!.config).toBe('string');
    expect(JSON.stringify(raw!.config)).not.toContain('secret-token-123');

    const fetched = await getIntegrationAccount(db, 'ical_airbnb', 'platform');
    const config = getDecryptedConfig(fetched!);
    expect(config.url).toBe('https://airbnb.example/ical/secret-token-123');
  });
});
