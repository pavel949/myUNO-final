import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertScopedRelease, RELEASE_SHA, RELEASE_MIGRATIONS } from './scoped-release-policy.mjs';
const valid = { releaseHead: RELEASE_SHA, controlHead: 'a'.repeat(40), eventSha: 'a'.repeat(40), ref: 'refs/heads/main', backupSha: RELEASE_SHA, mode: 'migrate', migrationNames: RELEASE_MIGRATIONS };
test('only approved ancestor and genuine control SHA can release', () => {
  assertScopedRelease(valid);
  for (const change of [{ releaseHead: 'b'.repeat(40) }, { controlHead: 'b'.repeat(40) }, { ref: 'refs/heads/other' }, { eventSha: '' }, { mode: 'deploy' }]) assert.throws(() => assertScopedRelease({ ...valid, ...change }));
});
test('backup success must attest the same application SHA', () => {
  for (const backupSha of [undefined, '', valid.eventSha]) assert.throws(() => assertScopedRelease({ ...valid, backupSha }));
  assertScopedRelease({ ...valid, mode: 'preflight', backupSha: undefined });
});
test('administrator SQL, missing SQL and unknown release SQL are rejected', () => {
  for (const migrationNames of [RELEASE_MIGRATIONS.slice(1), [...RELEASE_MIGRATIONS, '20261021190000_protected_workspace_administration'], [...RELEASE_MIGRATIONS, '20261021999999_unknown']]) assert.throws(() => assertScopedRelease({ ...valid, migrationNames }));
});
