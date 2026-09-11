#!/usr/bin/env node
/**
 * Deployment Gate: report production content that is still marked
 * `needs_review`, without allowing a historical backlog to block every build.
 *
 * Preview is where copy and UI are reviewed, so Preview never blocks on copy.
 * Production can run in two modes:
 *   - backlog/warn mode (default): preserve all review flags, emit the backlog,
 *     and allow the build to proceed;
 *   - strict mode: set CONTENT_REVIEW_GATE_STRICT=true to block production while
 *     any `needs_review` translation remains.
 *
 * This keeps review state honest: nothing is auto-approved or mutated here.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const GATE_ENABLED = process.env.CONTENT_REVIEW_GATE_ENABLED !== 'false';
const STRICT_GATE = process.env.CONTENT_REVIEW_GATE_STRICT === 'true';
const NODE_ENV = process.env.NODE_ENV || 'development';
const VERCEL_ENV = process.env.VERCEL_ENV;

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

    const heading = STRICT_GATE
      ? 'DEPLOYMENT BLOCKED: Content pending founder review'
      : 'CONTENT REVIEW BACKLOG: build allowed in temporary backlog mode';

    console.error(`\n${heading}\n`);
    console.error(`Found ${reviewPending.length} translations marked needs_review:\n`);

    Object.entries(summary).forEach(([ns, count]) => {
      console.error(`  • ${ns}: ${count} translation(s)`);
    });

    console.error('\nNo translation status was changed by this build.');
    if (STRICT_GATE) {
      console.error('Review and approve in Admin Content Editor, or temporarily unset CONTENT_REVIEW_GATE_STRICT.\n');
      return false;
    }

    console.warn(
      '\n[CONTENT GATE] Production build continuing in backlog mode. Set CONTENT_REVIEW_GATE_STRICT=true after the historical review queue is cleared.\n'
    );
    return true;
  } catch (error) {
    console.error('[CONTENT GATE] Error checking gate:', error.message);
    return STRICT_GATE && IS_PRODUCTION_RELEASE ? false : true;
  } finally {
    await prisma.$disconnect();
  }
}

const passed = await checkContentReviewGate();
process.exit(passed ? 0 : 1);
