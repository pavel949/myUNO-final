import { defineConfig } from 'vitest/config';
import path from 'path';
import fs from 'fs';

// Route/action integration tests import the real prisma singleton, which reads
// DATABASE_URL. It must point at the dedicated test DB (never production) and
// match the DB that resetDb() wipes. Resolve the test URL from the environment
// or .env (Vitest reloads .env into workers, so we inject it authoritatively
// via test.env below rather than mutating process.env here). In CI, DATABASE_URL
// and DATABASE_URL_TEST already hold the same value.
function resolveTestDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL_TEST) return process.env.DATABASE_URL_TEST;
  try {
    const envFile = fs.readFileSync(path.resolve(__dirname, '.env'), 'utf8');
    const match = envFile.match(/^DATABASE_URL_TEST=(.*)$/m);
    return match?.[1]?.trim();
  } catch {
    return undefined;
  }
}

const testDatabaseUrl = resolveTestDatabaseUrl();

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    globals: true,
    environment: 'node',
    // Component tests (.tsx) need a DOM
    environmentMatchGlobs: [['**/*.test.tsx', 'jsdom']],
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', '.next'],
    // Integration tests share one Postgres DB and reset it between tests.
    // Run in a single fork so parallel files never race on TRUNCATE (deadlocks)
    // or clobber each other's rows mid-test.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 20000,
    // Force the app's prisma singleton onto the test DB, overriding whatever
    // .env's DATABASE_URL points at (Vitest reloads .env into each worker).
    ...(testDatabaseUrl
      ? { env: { DATABASE_URL: testDatabaseUrl, DATABASE_URL_TEST: testDatabaseUrl } }
      : {}),
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
