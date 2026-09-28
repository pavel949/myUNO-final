import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, productionConfigurationReady } from './route';

describe('Integration: health endpoint', () => {
  it('checks the database without requiring optional deployment configuration', async () => {
    const response = await GET();
    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('fails closed on a strict check when production credentials are not configured', async () => {
    const response = await GET(new NextRequest('https://example.vercel.app/api/health?strict=1'));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.configuration).toBe('degraded');
    expect(body).not.toHaveProperty('missingSecrets');
    expect(JSON.stringify(body)).not.toContain('ENCRYPTION_KEY');
  });

  it('accepts the managed Vercel URL without requiring a custom domain', () => {
    const env = {
      DATABASE_URL: 'postgresql://example',
      SESSION_SECRET: 'a'.repeat(32),
      ENCRYPTION_KEY: 'a'.repeat(64),
      CRON_SECRET: 'b'.repeat(32),
      NEXTAUTH_URL: 'https://my-uno-final.vercel.app',
      BLOB_READ_WRITE_TOKEN: 'example',
      ALERT_WEBHOOK_URL: 'https://hooks.example.com/test',
      PAYMENT_PROVIDER: 'opn',
      OMISE_SECRET_KEY: 'skey_live_example',
      OMISE_WEBHOOK_SECRET: 'example',
    } as NodeJS.ProcessEnv;
    expect(productionConfigurationReady(env)).toBe(true);
    expect(productionConfigurationReady({ ...env, NEXTAUTH_URL: 'http://localhost:3000' })).toBe(false);
    expect(productionConfigurationReady({ ...env, ENCRYPTION_KEY: 'bad' })).toBe(false);
    expect(productionConfigurationReady({ ...env, PAYMENT_PROVIDER: 'mock' })).toBe(false);
  });
});
