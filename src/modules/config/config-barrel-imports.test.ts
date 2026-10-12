import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The config barrel is imported by the shared test utilities. If any file it
 * re-exports imports `@/modules/audit` (which imports the prisma singleton), every
 * test that mocks `@/lib/prisma` with a factory importing `@/test/util` deadlocks
 * at module load — the whole CI suite then hangs until its timeout.
 */
describe('config barrel stays free of the prisma singleton', () => {
  it('secret-vault.service does not import the audit module', () => {
    const source = readFileSync('src/modules/config/secret-vault.service.ts', 'utf8');
    expect(source).not.toMatch(/from '@\/modules\/audit'/);
    expect(source).not.toMatch(/from '@\/lib\/prisma'/);
  });
});
