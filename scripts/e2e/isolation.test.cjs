'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertIsolation, DATABASE_URL, BASE_URL } = require('./isolation.cjs');
const valid = { MYUNO_BROWSER_ACCEPTANCE: 'isolated', DATABASE_URL,
  DATABASE_URL_TEST: DATABASE_URL, NEXTAUTH_URL: BASE_URL,
  NEXTAUTH_SECRET: 'synthetic-browser-acceptance-only',
  ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' };
test('accepts only the exact dedicated local fixture environment', () => assertIsolation(valid));
for (const [name, value] of Object.entries({
  MYUNO_BROWSER_ACCEPTANCE: '', DATABASE_URL: 'postgresql://test:test@prod.example/myuno_browser_test',
  DATABASE_URL_TEST: 'postgresql://test:test@localhost:5432/myuno_test',
  NEXTAUTH_URL: 'https://myuno.app', NEXTAUTH_SECRET: 'real-key', RESEND_API_KEY: 'real-mail-key',
  BLOB_READ_WRITE_TOKEN: 'real-storage-key', OMISE_SECRET_KEY: 'real-payment-key',
  VERCEL_OIDC_TOKEN: 'real-oidc-token', BLOB_STORE_ID: 'real-store-id', SUPABASE_SERVICE_ROLE_KEY: 'real-service-key',
})) test(`refuses unsafe ${name}`, () => assert.throws(() => assertIsolation({ ...valid, [name]: value })));
