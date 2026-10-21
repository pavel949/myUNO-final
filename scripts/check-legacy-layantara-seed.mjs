import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertLegacyLayantaraSeedEnvironment } from '../src/modules/core/legacy-layantara-seed-guard.ts';
for (const mode of ['production', undefined, '', 'preview', 'staging']) {
  test('rejects historical seed before mutation in ' + String(mode), () => {
    assert.throws(() => assertLegacyLayantaraSeedEnvironment(mode), /development\/test only/);
  });
}
for (const mode of ['development', 'test']) {
  test('retains isolated fixtures in ' + mode, () => {
    assert.doesNotThrow(() => assertLegacyLayantaraSeedEnvironment(mode));
  });
}
