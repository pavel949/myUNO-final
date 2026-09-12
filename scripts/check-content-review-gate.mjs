#!/usr/bin/env node
/**
 * Deployment Gate: block production releases while content is still marked
 * `needs_review`, without preventing Preview deployments from compiling.
 *
 * Preview is where copy and UI are reviewed, so blocking Preview makes the
 * review gate self-defeating. Production remains strict.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const GATE_ENABLED = process.env.CONTENT_REVIEW_GATE_ENABLED !== 'false';
const NODE_ENV = process.env.NODE_ENV || 'development';
const VERCEL_ENV = process.env.VERCEL_ENV;

// `next build` sets NODE_ENV=production even for Vercel Preview. Use the actual
// deployment environment when Vercel provides it; outside Vercel, preserve the
// historical production-build behaviour.
const IS_PRODUCTION_RELEASE = VERCEL_ENV
  ? VERCEL_ENV === 'production'
  : NODE_ENV === 'production';

async function checkContentReviewGate() {
  try {
    if (!GATE_ENABLED) {
      console.log('[CONTENT GATE] Gate disabled (CONTENT_REVIEW_GATE_ENABLED=false)');
      return true;
    }

    if (!IS_PRODUCTION_RELEASE) {
      console.log(
        `[CONTENT GATE] Preview/non-production build (${VERCEL_ENV || NODE_ENV}); pending copy is allowed for review`
      );
      return true;
    }

    if (!process.env.DATABASE_URL) {
      console.log('[CONTENT GATE] DATABASE_URL not set; skipping gate in build environment');
      return true;
    }

    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      console.warn('[CONTENT GATE] Database unreachable; skipping gate check');
      return true;
    }

    const reviewPending = await prisma.translation.findMany({
      where: { status: 'needs_review' },
      select: {
        locale: true,
        value: true,
        createdAt: true,
        contentKey: {
          select: {
            key: true,
            namespace: true,
          },
        },
      },
      orderBy: { contentKey: { namespace: 'asc' } },
    });

    if (reviewPending.length === 0) {
      console.log('[CONTENT GATE] All content reviewed and approved');
      return true;
    }

    const summary = reviewPending.reduce((acc, item) => {
      const ns = item.contentKey.namespace;
      acc[ns] = (acc[ns] || 0) + 1;
      return acc;
    }, {});

    console.error('\nDEPLOYMENT BLOCKED: Content pending founder review\n');
    console.error(`Found ${reviewPending.length} translations marked needs_review:\n`);

    Object.entries(summary).forEach(([ns, count]) => {
      console.error(`  • ${ns}: ${count} translation(s)`);
    });

    console.error('\nReview required translations:');
    reviewPending.forEach((item) => {
      const preview = item.value.slice(0, 50).replace(/\n/g, ' ') || '[empty]';
      console.error(`  - ${item.contentKey.key} (${item.locale}): "${preview}..."`);
    });

    console.error('\nAction: review and approve in Admin Content Editor.');
    console.error('Production remains blocked until pending content is approved.\n');
    return false;
  } catch (error) {
    console.error('[CONTENT GATE] Error checking gate:', error.message);
    return IS_PRODUCTION_RELEASE ? false : true;
  } finally {
    await prisma.$disconnect();
  }
}

const passed = await checkContentReviewGate();
process.exit(passed ? 0 : 1);
