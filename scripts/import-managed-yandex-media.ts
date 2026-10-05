import { PrismaClient } from '@prisma/client';
import { MANAGED_YANDEX_SOURCES, importManagedYandexBatch } from '../src/modules/media';

const db = new PrismaClient();

function arg(name: string, fallback?: string) {
  const prefix = `--${name}=`;
  const value = process.argv.find(v => v.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

const apply = process.argv.includes('--apply');
const sourceKey = arg('source');
const batchSize = Math.min(25, Math.max(1, Number(arg('batch-size', '10')) || 10));

async function runSource(key: string) {
  let offset = 0;
  for (;;) {
    if (!apply) {
      console.log(`DRY RUN: source=${key}; use --apply to ingest through canonical MediaAsset storage.`);
      return;
    }
    const result = await importManagedYandexBatch(db, { sourceKey: key, offset, limit: batchSize });
    console.log(JSON.stringify(result));
    if (result.errors.length) throw new Error(`Import errors in ${key}: ${JSON.stringify(result.errors)}`);
    if (result.done) return;
    offset = result.nextOffset;
  }
}

async function main() {
  if (process.env.NODE_ENV === 'production' && !process.env.BLOB_READ_WRITE_TOKEN && !(process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID)) {
    throw new Error('Durable Blob storage is required in production.');
  }
  const sources = sourceKey ? MANAGED_YANDEX_SOURCES.filter(s => s.key === sourceKey) : MANAGED_YANDEX_SOURCES;
  if (!sources.length) throw new Error(`Unknown source: ${sourceKey}`);
  for (const source of sources) await runSource(source.key);
}

main()
  .finally(async () => db.$disconnect())
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
