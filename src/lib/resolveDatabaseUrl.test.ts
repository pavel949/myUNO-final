import { describe, it, expect, afterEach } from 'vitest';
import { resolveDatabaseUrl } from './resolveDatabaseUrl';

const DIRECT =
  'postgresql://postgres:s3cret@db.burcnghheyzbzffzgmjz.supabase.co:5432/postgres';

describe('resolveDatabaseUrl', () => {
  afterEach(() => {
    delete process.env.DATABASE_POOLER_HOST;
    delete process.env.SUPABASE_PROJECT_REF;
    delete process.env.DATABASE_CONNECTION_LIMIT;
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
    expect(url.searchParams.get('connection_limit')).toBe('1');
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
    expect(url.searchParams.get('connection_limit')).toBe('1');
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
    expect(url.searchParams.get('connection_limit')).toBe('1');
  });

  it('honours SUPABASE_PROJECT_REF when qualifying a pooler user', () => {
    process.env.SUPABASE_PROJECT_REF = 'otherref';
    const raw =
      'postgresql://postgres:s3cret@aws-1-ap-south-1.pooler.supabase.com:5432/postgres';
    const url = new URL(resolveDatabaseUrl(raw)!);
    expect(url.username).toBe('postgres.otherref');
  });

  it('caps each isolate at one session-pooler client', () => {
    const raw =
      'postgresql://postgres.burcnghheyzbzffzgmjz:s3cret@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require';
    const url = new URL(resolveDatabaseUrl(raw)!);
    expect(url.searchParams.get('connection_limit')).toBe('1');
  });

  it('honours DATABASE_CONNECTION_LIMIT when the env cap is raised', () => {
    process.env.DATABASE_CONNECTION_LIMIT = '2';
    const raw =
      'postgresql://postgres.burcnghheyzbzffzgmjz:s3cret@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require';
    const url = new URL(resolveDatabaseUrl(raw)!);
    expect(url.searchParams.get('connection_limit')).toBe('2');
  });

  it('leaves an explicit connection_limit on the URL alone', () => {
    const raw =
      'postgresql://postgres.burcnghheyzbzffzgmjz:s3cret@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require&connection_limit=3';
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
