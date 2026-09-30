/**
 * Explicit, idempotent Layantara editorial import. Never calls the legacy
 * seedLayantara (which uses a different project slug/placeholder inventory).
 * Usage: npx tsx scripts/seed-layantara-project-editorial.ts
 */
import { PrismaClient } from '@prisma/client';
import { seedLayantaraProjectEditorial } from '../src/modules/content/project-editorial.seed';

const db = new PrismaClient();
seedLayantaraProjectEditorial(db)
  .then(result => { console.log(result); })
  .catch(error => { console.error(error); process.exitCode = 1; })
  .finally(() => db.$disconnect());
