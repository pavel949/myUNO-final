'use strict';
const { assertIsolation } = require('./isolation.cjs');
assertIsolation();
const fs = require('node:fs');
const { urlToHttpOptions } = require('node:url');

// Defense in depth for application HTTP, not an operating-system network
// sandbox. Credentials are synthetic and the database guard remains exact.
const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
function blocked(origin) {
  // Log origins only; never leak query strings, headers, payloads or tokens.
  fs.mkdirSync('browser-results', { recursive: true });
  fs.appendFileSync('browser-results/blocked-server-egress.log', origin + '\n');
  throw new Error('External HTTP is disabled in isolated browser acceptance');
}
function checkUrl(input) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (!['http:', 'https:'].includes(url.protocol) || !LOOPBACK.has(url.hostname)) blocked(url.origin);
}
function checkRequest(input, options, protocol) {
  // Node merges request(url, options) and gives options.hostname precedence.
  // Validate the effective connection target, not merely the initial URL.
  const initial = typeof input === 'string' || input instanceof URL
    ? urlToHttpOptions(new URL(input)) : (input || {});
  const effective = { ...initial, ...(options && typeof options === 'object' ? options : {}) };
  const hostname = effective.hostname || effective.host || 'localhost';
  // A socket path or custom connector is not covered by a hostname check.
  if (effective.socketPath || effective.createConnection) blocked('unsupported-http-transport');
  const host = String(hostname).toLowerCase();
  if (!LOOPBACK.has(host)) {
    const scheme = effective.protocol || protocol + ':';
    const authority = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
    blocked(`${scheme}//${authority}${effective.port ? ':' + effective.port : ''}`);
  }
}
const originalFetch = globalThis.fetch;
globalThis.fetch = function(input, init) {
  checkUrl(input);
  // undici follows redirects internally, bypassing this wrapper. Fail closed
  // instead; callers explicitly inspecting manual redirects may still do so.
  const redirect = init?.redirect ?? input?.redirect;
  return originalFetch.call(this, input, { ...init, redirect: redirect === 'manual' ? 'manual' : 'error' });
};
for (const protocol of ['http', 'https']) {
  const mod = require('node:' + protocol);
  const request = mod.request;
  mod.request = function(input, ...args) { checkRequest(input, args[0], protocol); return request.call(this, input, ...args); };
  mod.get = function(input, ...args) { const req = mod.request(input, ...args); req.end(); return req; };
}
