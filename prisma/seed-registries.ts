import { PrismaClient } from '@prisma/client';
import { seedConfig } from '../src/modules/config/seed';
import { seedContent } from '../src/modules/content/seed';

/**
 * The registries-only seed — safe to run against production.
 *
 * `prisma/seed.ts` is the *staging* seed: it also creates demo projects, units,
 * providers and identities (T-041), which must never appear on the live domain.
 * This entry point seeds only the two registries the application reads on every
 * request and cannot render without:
 *
 * - **Config** (doc 04) — every commission, fee, cap, markup and SLA, read
 *   through `config.get()`. Missing parameters make pricing and policy reads
 *   fall back or fail.
 * - **Content** (doc 05) — the `common.*` content keys every page renders
 *   through `t()`. Missing keys surface as raw key names in the UI.
 *
 * Deliberately NOT seeded here: the audience FAQ and legal-page content
 * (`audience-faq.seed`, `legal-pages.seed`). Both are still `needs_review`, and
 * review found wrong-language copy in them — Thai and Indonesian text sitting in
 * `ru` fields, and a data-controller name that contradicts the privacy page.
 * Publishing that to a live domain is worse than showing nothing, so those wait
 * on the founder's tone review and counsel's legal review (Q35/Q36).
 *
 * Both seeds below are idempotent: re-running updates in place, never duplicates.
 *
 * Usage: `npm run db:seed:registries` with DATABASE_URL pointed at the target.
 */
const db = new PrismaClient();

async function main() {
  try {
    console.log('Seeding registries (config + content)...');
    await seedConfig(db);
    console.log('✓ Config seeded');
    await seedContent(db);
    console.log('✓ Content seeded');
    console.log('✓ Registries seeded — no demo data was written');
  } catch (error) {
    console.error('Registry seed failed:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
