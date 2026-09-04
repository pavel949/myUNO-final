import { describe, it, expect, afterEach } from 'vitest';
import { resolveDatabaseUrl } from './resolveDatabaseUrl';

const DIRECT =
  'postgresql://postgres:s3cret@db.burcnghheyzbzffzgmjz.supabase.co:5432/postgres';

describe('resolveDatabaseUrl', () => {
  afterEach(() => {
    delete process.env.DATABASE_POOLER_HOST;
    delete process.env.SUPABASE_PROJECT_REF;
  });

  it('rewrites the IPv6-only direct host to the session pooler on 5432', () => {
    const resolved = resolveDatabaseUrl(DIRECT);
    expect(resolved).toBeDefined();
    const url = new URL(resolved!);
    expect(url.hostname).toBe('aws-1-ap-south-1.pooler.supabase.com');
    expect(url.port).toBe('5432');
    expect(url.username).toBe('postgres.burcnghheyzbzffzgmjz');
    expect(url.password).toBe('s3cret');
    expect(url.pathname).toBe('/postgres');
    expect(url.searchParams.get('sslmode')).toBe('require');
  });

  it('honours DATABASE_POOLER_HOST when the founder points at a different pooler', () => {
    process.env.DATABASE_POOLER_HOST = 'aws-0-ap-south-1.pooler.supabase.com';
    const url = new URL(resolveDatabaseUrl(DIRECT)!);
    expect(url.hostname).toBe('aws-0-ap-south-1.pooler.supabase.com');
  });

  it('moves a transaction-pooler URL off port 6543', () => {
    const raw =
      'postgresql://postgres.burcnghheyzbzffzgmjz:s3cret@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true';
    const url = new URL(resolveDatabaseUrl(raw)!);
    expect(url.port).toBe('5432');
    expect(url.searchParams.has('pgbouncer')).toBe(false);
    expect(url.searchParams.get('sslmode')).toBe('require');
  });

  it('qualifies a bare postgres user on the session pooler', () => {
    const raw =
      'postgresql://postgres:s3cret@aws-1-ap-south-1.pooler.supabase.com:5432/postgres';
    const url = new URL(resolveDatabaseUrl(raw)!);
    expect(url.username).toBe('postgres.burcnghheyzbzffzgmjz');
    expect(url.hostname).toBe('aws-1-ap-south-1.pooler.supabase.com');
    expect(url.port).toBe('5432');
    expect(url.password).toBe('s3cret');
    expect(url.searchParams.get('sslmode')).toBe('require');
  });

  it('honours SUPABASE_PROJECT_REF when qualifying a pooler user', () => {
    process.env.SUPABASE_PROJECT_REF = 'otherref';
    const raw =
      'postgresql://postgres:s3cret@aws-1-ap-south-1.pooler.supabase.com:5432/postgres';
    const url = new URL(resolveDatabaseUrl(raw)!);
    expect(url.username).toBe('postgres.otherref');
  });

  it('leaves a correct session-pooler URL unchanged', () => {
    const raw =
      'postgresql://postgres.burcnghheyzbzffzgmjz:s3cret@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require';
    expect(resolveDatabaseUrl(raw)).toBe(raw);
  });

  it('leaves localhost (local/CI) untouched', () => {
    const raw = 'postgresql://test:test@localhost:5432/myuno_test';
    expect(resolveDatabaseUrl(raw)).toBe(raw);
  });

  it('returns undefined / unparseable strings as-is', () => {
    expect(resolveDatabaseUrl(undefined)).toBeUndefined();
    expect(resolveDatabaseUrl('not-a-url')).toBe('not-a-url');
  });
});
