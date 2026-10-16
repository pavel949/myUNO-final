'use strict';
// Harness checks only: these do not launch a browser or connect to PostgreSQL.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, readdirSync, rmSync, readFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { DATABASE_URL, BASE_URL } = require('./isolation.cjs');
const runner = join(__dirname, 'workspace-navigation.mjs');
const valid = { MYUNO_BROWSER_ACCEPTANCE: 'isolated', DATABASE_URL, DATABASE_URL_TEST: DATABASE_URL,
  NEXTAUTH_URL: BASE_URL, NEXTAUTH_SECRET: 'synthetic-browser-acceptance-only',
  ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' };

test('workspace navigation runner parses without executing browser or database code', () => {
  const result = spawnSync(process.execPath, ['--check', runner], { encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' } });
  assert.equal(result.status, 0, result.stderr);
});
for (const [name, override, message] of [
  ['missing opt-in', { MYUNO_BROWSER_ACCEPTANCE: '' }, 'Explicit isolated acceptance opt-in required'],
  ['remote database', { DATABASE_URL: 'postgresql://test:test@production.example/myuno_browser_test' }, 'Only the dedicated loopback browser DB is allowed'],
  ['remote app', { NEXTAUTH_URL: 'https://myuno.app' }, 'Only the local application is allowed'],
  ['live provider credential', { RESEND_API_KEY: 'non-secret-test-sentinel' }, 'RESEND_API_KEY must be absent'],
]) test(`workspace navigation rejects ${name} before loading clients or writing evidence`, () => {
  const cwd = mkdtempSync(join(tmpdir(), 'myuno-navigation-guard-'));
  try {
    const env = { ...process.env, NODE_OPTIONS: '', ...valid, ...override };
    const result = spawnSync(process.execPath, [runner], { cwd, env, encoding: 'utf8' });
    assert.equal(result.status, 1, result.stderr);
    assert.ok(result.stderr.includes(message), result.stderr);
    assert.equal(result.stderr.includes('Cannot find module'), false, 'Guard must run before loading optional clients');
    assert.deepEqual(readdirSync(cwd), [], 'Rejected invocation must not manufacture execution evidence');
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
test('the runner is guarded and does not create or repair fixture records', () => {
  const source = readFileSync(runner, 'utf8');
  const guard = source.indexOf("require('./isolation.cjs').assertIsolation()");
  assert.ok(guard >= 0 && guard < source.indexOf("require('playwright')") && guard < source.indexOf("require('@prisma/client')"));
  assert.ok(source.indexOf("require('./block-egress.cjs')") < source.indexOf("require('playwright')"));
  assert.doesNotMatch(source, /db\.[\w]+\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/);
  assert.doesNotMatch(source, /route\.fulfill\s*\(/, 'No mocked successful app or permission responses');
});
