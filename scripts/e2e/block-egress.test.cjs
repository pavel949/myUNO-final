'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Every underlying transport is a stub. These tests make no network requests.
function harness() {
  const calls = []; const logs = [];
  const http = { request: (...args) => { calls.push(args); return { end() {} }; } };
  const https = { request: (...args) => { calls.push(args); return { end() {} }; } };
  const fetch = (...args) => { calls.push(args); return Promise.resolve('local'); };
  const sandbox = { URL, fetch, require: name => {
    if (name === './isolation.cjs') return { assertIsolation() {} };
    if (name === 'node:fs') return { mkdirSync() {}, appendFileSync: (_file, text) => logs.push(text) };
    if (name === 'node:http') return http;
    if (name === 'node:https') return https;
    if (name === 'node:url') return require(name);
    throw new Error('Unexpected module ' + name);
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'block-egress.cjs'), 'utf8'), sandbox);
  return { http, https, fetch: sandbox.fetch, calls, logs };
}

for (const protocol of ['http', 'https']) {
  test(protocol + ': checks hostname overrides on URL inputs', () => {
    const h = harness();
    assert.throws(() => h[protocol].request(`${protocol}://localhost:3000/private?token=secret`, { hostname: 'external.example' }), /External HTTP/);
    assert.equal(h.calls.length, 0);
    assert.equal(h.logs.length, 1);
    assert.ok(!h.logs[0].includes('secret'));
  });
  test(protocol + ': checks hostname overrides on object inputs', () => {
    const h = harness();
    assert.throws(() => h[protocol].request({ hostname: 'localhost' }, { hostname: 'external.example' }), /External HTTP/);
    assert.equal(h.calls.length, 0);
  });
  test(protocol + ': accepts effective loopback URL/options and callback overloads', () => {
    const h = harness();
    h[protocol].request(`${protocol}://localhost:3000`, () => {});
    h[protocol].request(new URL(`${protocol}://127.0.0.1:3000`), { method: 'POST' });
    h[protocol].request({ hostname: '::1', port: 3000 }, () => {});
    h[protocol].request(`${protocol}://external.example`, { hostname: 'localhost' });
    assert.equal(h.calls.length, 4);
    assert.deepEqual(h.logs, []);
  });
  test(protocol + ': get cannot bypass request guard', () => {
    const h = harness();
    assert.throws(() => h[protocol].get(`${protocol}://localhost`, { hostname: 'external.example' }), /External HTTP/);
    assert.equal(h.calls.length, 0);
  });
  test(protocol + ': rejects custom transports', () => {
    const h = harness();
    assert.throws(() => h[protocol].request({ socketPath: '/tmp/socket' }), /External HTTP/);
    assert.throws(() => h[protocol].request({ hostname: 'localhost', createConnection() {} }), /External HTTP/);
    assert.equal(h.calls.length, 0);
  });
}
test('fetch accepts loopback and blocks external URLs without logging query secrets', async () => {
  const h = harness();
  assert.equal(await h.fetch('http://localhost:3000'), 'local');
  assert.throws(() => h.fetch({ url: 'https://external.example/secret?token=secret' }), /External HTTP/);
  assert.equal(h.calls.length, 1);
  assert.deepEqual(h.logs, ['https://external.example\n']);
});

test('fetch refuses automatic redirects and preserves explicitly manual redirects', async () => {
  const h = harness();
  await h.fetch('http://localhost:3000');
  await h.fetch('http://localhost:3000', { redirect: 'follow', method: 'POST' });
  await h.fetch('http://localhost:3000', { redirect: 'manual' });
  await h.fetch({ url: 'http://localhost:3000', redirect: 'manual' });
  await h.fetch({ url: 'http://localhost:3000', redirect: 'manual' }, { redirect: 'follow' });
  assert.deepEqual(h.calls.map(call => call[1].redirect), ['error', 'error', 'manual', 'manual', 'error']);
  assert.equal(h.calls[1][1].method, 'POST');
});
