'use strict';
const assert = require('node:assert/strict');

// Deliberately exact: a production-looking URL is never a test target merely
// because its path contains "test". No reset/delete helper is used by this suite.
const DATABASE_URL = 'postgresql://test:test@localhost:5432/myuno_browser_test';
const BASE_URL = 'http://localhost:3000';
function assertIsolation(env = process.env) {
  assert.equal(env.MYUNO_BROWSER_ACCEPTANCE, 'isolated', 'Explicit isolated acceptance opt-in required');
  assert.equal(env.DATABASE_URL, DATABASE_URL, 'Only the dedicated loopback browser DB is allowed');
  assert.equal(env.DATABASE_URL_TEST, DATABASE_URL, 'Application and fixture DB must match');
  assert.equal(env.NEXTAUTH_URL, BASE_URL, 'Only the local application is allowed');
  assert.equal(env.NEXTAUTH_SECRET, 'synthetic-browser-acceptance-only');
  assert.equal(env.ENCRYPTION_KEY, '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
  for (const name of ['RESEND_API_KEY', 'BLOB_READ_WRITE_TOKEN', 'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET', 'TELEGRAM_BOT_TOKEN', 'STRIPE_SECRET_KEY',
    'SUPABASE_SERVICE_ROLE_KEY', 'VERCEL_TOKEN']) {
    assert.ok(!env[name], `${name} must be absent from browser acceptance`);
  }
  return { databaseUrl: DATABASE_URL, baseUrl: BASE_URL };
}
module.exports = { assertIsolation, DATABASE_URL, BASE_URL };
if (require.main === module) { assertIsolation(); console.log('Isolated browser environment accepted'); }
