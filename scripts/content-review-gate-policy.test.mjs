import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateContentReviewGate, isolatedContentBuild } from './content-review-gate-policy.mjs';
const prod = { NODE_ENV: 'production', DATABASE_URL: 'postgresql://synthetic:synthetic@localhost/app' };
const db = count => ({ translation: { count: async () => count } });

test('production cannot pass missing, unreachable or unreviewed registries', async () => {
  assert.deepEqual(await evaluateContentReviewGate({ NODE_ENV: 'production' }, db(0)), { passed: false, state: 'database_missing' });
  const error = { translation: { count: async () => { throw new Error('synthetic sensitive database detail'); } } };
  assert.deepEqual(await evaluateContentReviewGate(prod, error), { passed: false, state: 'database_unavailable' });
  assert.deepEqual(await evaluateContentReviewGate(prod, db(4)), { passed: false, state: 'review_pending', pending: 4 });
  assert.deepEqual(await evaluateContentReviewGate(prod, db(0)), { passed: true, state: 'reviewed', pending: 0 });
  assert.equal((await evaluateContentReviewGate(prod, db(NaN))).passed, false);
});

test('a production deployment cannot disable review, including a CI-labelled deployment', async () => {
  for (const env of [prod, { ...prod, VERCEL_ENV: 'production' }, { ...prod, VERCEL_TARGET_ENV: 'production', CI: 'true' }]) {
    assert.equal((await evaluateContentReviewGate({ ...env, CONTENT_REVIEW_GATE_ENABLED: 'false' }, db(10))).state, 'production_bypass_refused');
  }
});

test('only disposable local matching test databases may bypass a production compile in CI', async () => {
  const url = 'postgresql://synthetic:synthetic@localhost/myuno_test';
  const isolated = { NODE_ENV: 'production', CONTENT_REVIEW_GATE_ENABLED: 'false', CI: 'true', DATABASE_URL: url, DATABASE_URL_TEST: url };
  assert.equal((await evaluateContentReviewGate(isolated, db(20))).passed, true);
  for (const patch of [
    { DATABASE_URL_TEST: url + '_foreign' }, { CI: '' }, { VERCEL_ENV: 'production' },
    { DATABASE_URL: 'postgresql://synthetic:synthetic@remote.invalid/myuno_test', DATABASE_URL_TEST: 'postgresql://synthetic:synthetic@remote.invalid/myuno_test' },
    { DATABASE_URL: 'postgresql://synthetic:synthetic@localhost/production', DATABASE_URL_TEST: 'postgresql://synthetic:synthetic@localhost/production' },
  ]) assert.equal(isolatedContentBuild({ ...isolated, ...patch }), false);
});

test('development without a database remains usable without claiming content was reviewed', async () => {
  assert.deepEqual(await evaluateContentReviewGate({}, db(0)), { passed: true, state: 'database_missing' });
  assert.equal((await evaluateContentReviewGate({ ...prod, NODE_ENV: 'development' }, db(7))).state, 'review_pending');
});
