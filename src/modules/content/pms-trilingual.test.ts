import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * PMS operational surfaces must ship explicit EN/RU/TH strings (doc 05).
 * Keys that only define en+ru fall back to English for Thai guests — not parity.
 */
const SEED_PATH = join(__dirname, 'seed.ts');

/** Namespaces and prefixes covered by the PMS parity multilingual gate. */
const PMS_KEY_MATCHERS: Array<(key: string, namespace: string) => boolean> = [
  (_, ns) => ns === 'notify',
  (_, ns) => ns === 'booking',
  (_, ns) => ns === 'email',
  (key) => key.startsWith('owner.'),
  (key) => key.startsWith('ops.'),
  (key) => key.startsWith('mc.'),
  (_, ns) => ns === 'staff',
  (key) => key.startsWith('staff.'),
  (_, ns) => ns === 'residence',
  (key) => key.startsWith('residence.'),
  (_, ns) => ns === 'juristic',
  (key) => key.startsWith('juristic.'),
  (_, ns) => ns === 'provider',
  (key) => key.startsWith('provider.'),
  (_, ns) => ns === 'nav',
  (key) => key.startsWith('nav.'),
  (_, ns) => ns === 'services',
  (key) => key.startsWith('services.'),
  (_, ns) => ns === 'service-order',
  (key) => key.startsWith('service-order.'),
  (_, ns) => ns === 'admin',
  (key) => key.startsWith('admin.'),
  (_, ns) => ns === 'tickets',
  (key) => key.startsWith('tickets.'),
  (_, ns) => ns === 'orders',
  (key) => key.startsWith('orders.'),
  (_, ns) => ns === 'checkin',
  (key) => key.startsWith('checkin.'),
  (_, ns) => ns === 'payments',
  (key) => key.startsWith('payments.'),
  (_, ns) => ns === 'messages',
  (key) => key.startsWith('messages.'),
  (_, ns) => ns === 'guests',
  (key) => key.startsWith('guests.'),
  (_, ns) => ns === 'account',
  (key) => key.startsWith('account.'),
  (_, ns) => ns === 'search',
  (_, ns) => ns === 'catalog',
  (_, ns) => ns === 'listing',
  (_, ns) => ns === 'home',
  (_, ns) => ns === 'common',
  (_, ns) => ns === 'projects',
  (_, ns) => ns === 'project_page',
  (_, ns) => ns === 'auth',
  (_, ns) => ns === 'legal',
  (_, ns) => ns === 'landing',
  (_, ns) => ns === 'trust',
  (_, ns) => ns === 'area',
  (_, ns) => ns === 'order',
];

function isPmsKey(key: string, namespace: string): boolean {
  return PMS_KEY_MATCHERS.some((match) => match(key, namespace));
}

/** Single-line KeyDef rows in seed.ts (all PMS keys use this shape). */
function parseSeedLines(source: string): { key: string; namespace: string; hasTh: boolean }[] {
  const rows: { key: string; namespace: string; hasTh: boolean }[] = [];
  for (const line of source.split('\n')) {
    const m = line.match(/^\s*\{ key: '([^']+)', namespace: '([^']+)'/);
    if (!m) continue;
    rows.push({
      key: m[1],
      namespace: m[2],
      hasTh: /,\s*th:\s*'/.test(line),
    });
  }
  return rows;
}

describe('PMS content keys are trilingual (EN/RU/TH)', () => {
  const defs = parseSeedLines(readFileSync(SEED_PATH, 'utf8'));
  const pmsKeys = defs.filter((d) => isPmsKey(d.key, d.namespace));

  it('includes PMS keys in the seed file', () => {
    expect(pmsKeys.length).toBeGreaterThan(100);
  });

  it('every PMS key defines an explicit th: translation', () => {
    const missing = pmsKeys.filter((d) => !d.hasTh).map((d) => d.key);
    expect(missing, `Add th: to ${missing.slice(0, 5).join(', ')}…`).toEqual([]);
  });
});
