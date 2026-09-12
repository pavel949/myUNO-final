import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDb, createProject } from '@/test/util';
import {
  getDecryptedConfig,
  getIntegrationAccount,
  registerIntegrationAccount,
} from './integrations';

describe('integration environment isolation', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('stores the environment and refuses to overwrite the same scoped account from another environment', async () => {
    const project = await createProject();

    const account = await registerIntegrationAccount(
      db,
      'ical_airbnb',
      'project',
      { environment: 'production', feedUrl: 'https://example.test/prod.ics' },
      project.id,
    );

    expect(getDecryptedConfig(account).environment).toBe('production');

    await expect(
      registerIntegrationAccount(
        db,
        'ical_airbnb',
        'project',
        { environment: 'preview', feedUrl: 'https://example.test/preview.ics' },
        project.id,
      ),
    ).rejects.toThrow('Integration environment mismatch');

    const production = await getIntegrationAccount(
      db,
      'ical_airbnb',
      'project',
      project.id,
      'production',
    );
    const preview = await getIntegrationAccount(
      db,
      'ical_airbnb',
      'project',
      project.id,
      'preview',
    );

    expect(production?.id).toBe(account.id);
    expect(preview).toBeNull();
  });
});
