#!/usr/bin/env node
/**
 * Deployment Gate: block production releases while content is still marked
 * `needs_review`, without preventing Preview deployments from compiling.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const GATE_ENABLED = process.env.CONTENT_REVIEW_GATE_ENABLED !== 'false';
const NODE_ENV = process.env.NODE_ENV || 'development';
const VERCEL_ENV = process.env.VERCEL_ENV;
const IS_PRODUCTION_RELEASE = VERCEL_ENV ? VERCEL_ENV === 'production' : NODE_ENV === 'production';
async function checkContentReviewGate() {
  try {
    if (!GATE_ENABLED) { console.log('[CONTENT GATE] Gate disabled'); return true; }
    if (!IS_PRODUCTION_RELEASE) { console.log(`[CONTENT GATE] ${VERCEL_ENV || NODE_ENV}: pending copy allowed for review`); return true; }
    if (!process.env.DATABASE_URL) { console.log('[CONTENT GATE] DATABASE_URL not set; skipping'); return true; }
    try { await prisma.$queryRaw`SELECT 1`; } catch { console.warn('[CONTENT GATE] Database unreachable; skipping'); return true; }
    const reviewPending = await prisma.translation.findMany({
      where: { status: 'needs_review' },
      select: { locale: true, value: true, contentKey: { select: { key: true, namespace: true } } },
      orderBy: { contentKey: { namespace: 'asc' } },
    });
    if (reviewPending.length === 0) { console.log('[CONTENT GATE] All content reviewed'); return true; }
    console.error(`DEPLOYMENT BLOCKED: ${reviewPending.length} translation(s) need review`);
    reviewPending.forEach((item) => console.error(`- ${item.contentKey.key} (${item.locale})`));
    return false;
  } catch (error) {
    console.error('[CONTENT GATE] Error:', error.message);
    return IS_PRODUCTION_RELEASE ? false : true;
  } finally { await prisma.$disconnect(); }
}
const passed = await checkContentReviewGate();
process.exit(passed ? 0 : 1);
