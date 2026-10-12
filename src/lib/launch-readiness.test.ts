import { describe, it, expect } from 'vitest';
import { evaluateEnvReadiness } from './launch-readiness';
import { SECRET_CATALOG } from './secret-catalog';

describe('launch readiness (environment facts)', () => {
  it('flags every blocking item as needing action on an empty environment, never marks card payments blocking', () => {
    const items = evaluateEnvReadiness({});
    expect(items.every((i) => i.state === 'action')).toBe(true);
    expect(items.find((i) => i.id === 'card_payments')?.blocking).toBe(false);
  });

  it('treats the scheduler as ready only in external mode, and cards only with provider and all three keys', () => {
    const base = { SCHEDULER_MODE: 'vercel-daily', PAYMENT_PROVIDER: 'omise', OMISE_PUBLIC_KEY: 'p', OMISE_SECRET_KEY: 's' };
    const get = (env: Record<string, string>, id: string) => evaluateEnvReadiness(env).find((i) => i.id === id)?.state;
    expect(get(base, 'scheduler_mode')).toBe('action');
    expect(get(base, 'card_payments')).toBe('action');
    expect(get({ ...base, SCHEDULER_MODE: 'external', OMISE_WEBHOOK_SECRET: 'w' }, 'scheduler_mode')).toBe('ok');
    expect(get({ ...base, OMISE_WEBHOOK_SECRET: 'w' }, 'card_payments')).toBe('ok');
  });

  it('keeps catalogue names unique and valid', () => {
    const names = SECRET_CATALOG.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.every((n) => /^[A-Za-z0-9_.-]{1,100}$/.test(n))).toBe(true);
  });

  it('catalogues every variable that .env.example documents', async () => {
    const { readFileSync } = await import('node:fs');
    const documented = readFileSync('.env.example', 'utf8')
      .split('\n')
      .map((l) => /^([A-Z][A-Z0-9_]+)=/.exec(l)?.[1])
      .filter((n): n is string => Boolean(n))
      .filter((n) => !['DATABASE_URL_TEST', 'LOG_SILENT', 'CONTENT_REVIEW_GATE_ENABLED', 'UNIFIED_BOOKING_INTAKE_ENABLED', 'UNIFIED_CHANNEL_ENVIRONMENT', 'LAYANTARA_PROTECTION_INTAKE_ENABLED'].includes(n));
    const catalogued = new Set(SECRET_CATALOG.map((s) => s.name));
    expect(documented.filter((n) => !catalogued.has(n))).toEqual([]);
  });
});
