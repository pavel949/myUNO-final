#!/usr/bin/env node
/**
 * Deployment Gate: Ensure no content with `needs_review=true` exists before deployment.
 *
 * This script runs as part of the build pipeline and blocks deployment if any
 * content flagged for review (legal pages, copy tone checks, etc.) is still pending.
 *
 * Run manually: npm run check:content-gate
 * Part of build: npm run build (will fail if gate blocks)
 */

import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

const GATE_ENABLED = process.env.CONTENT_REVIEW_GATE_ENABLED !== 'false';
const ENV = process.env.NODE_ENV || 'development';

async function checkContentReviewGate() {
  try {
    if (!GATE_ENABLED) {
      console.log('[CONTENT GATE] ℹ️  Gate is disabled (CONTENT_REVIEW_GATE_ENABLED=false)');
      return true;
    }

    // Check if DATABASE_URL is set; if not, skip in build environments
    if (!process.env.DATABASE_URL) {
      console.log('[CONTENT GATE] ⓘ  DATABASE_URL not set; skipping gate (CI/build environment)');
      return true;
    }

    const reviewPending = await prisma.content.findMany({
      where: { needs_review: true },
      select: {
        key: true,
        namespace: true,
        value_en: true,
        created_at: true,
      },
      orderBy: { namespace: 'asc' },
    });

    if (reviewPending.length === 0) {
      console.log('[CONTENT GATE] ✅ All content reviewed and approved');
      return true;
    }

    // Content pending review found
    const summary = reviewPending.reduce((acc, item) => {
      acc[item.namespace] = (acc[item.namespace] || 0) + 1;
      return acc;
    }, {});

    console.error('\n❌ DEPLOYMENT BLOCKED: Content pending founder review\n');
    console.error(`Found ${reviewPending.length} content keys marked needs_review:\n`);

    Object.entries(summary).forEach(([ns, count]) => {
      console.error(`  • ${ns}: ${count} key(s)`);
    });

    console.error('\nReview required keys:');
    reviewPending.forEach((item) => {
      const preview = item.value_en?.slice(0, 50).replace(/\n/g, ' ') || '[empty]';
      console.error(`  - ${item.key} (${item.namespace}): "${preview}..."`);
    });

    console.error(`\n→ Action: Review and approve in Admin Content Editor`);
    console.error(`→ Then set needs_review=false on each key`);
    console.error(`→ To skip this gate: CONTENT_REVIEW_GATE_ENABLED=false npm run build`);
    console.error(`\nDocs: CLAUDE.md § Legal non-negotiables\n`);

    // In production, always block. In dev, allow override
    if (ENV === 'production') {
      return false;
    }

    // In dev, warn but continue
    console.warn('[CONTENT GATE] ⚠️  WARNING: Gate would block in production');
    return true;
  } catch (error) {
    console.error('[CONTENT GATE] ❌ Error checking gate:', error.message);
    // Don't block the build on database errors in development
    if (ENV === 'production') {
      return false;
    }
    return true;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the gate
const passed = await checkContentReviewGate();
process.exit(passed ? 0 : 1);
