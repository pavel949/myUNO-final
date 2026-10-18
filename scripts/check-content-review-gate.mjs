#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';
import { contentGateDatabaseUrl, evaluateContentReviewGate } from './content-review-gate-policy.mjs';

const url = contentGateDatabaseUrl(process.env);
const prisma = new PrismaClient(url ? { datasources: { db: { url } } } : undefined);
try {
  const result = await evaluateContentReviewGate(process.env, prisma);
  // Status/count only. Driver exceptions and editable translation values may contain secrets or private text.
  const log = result.passed ? console.log : console.error;
  log(`[CONTENT GATE] ${result.state}${result.pending === undefined ? '' : ` (${result.pending} translations need review)`}`);
  if (!result.passed) console.error('Release blocked. Restore registry connectivity or review content in the existing editor; no automatic approval is performed.');
  process.exitCode = result.passed ? 0 : 1;
} finally { await prisma.$disconnect(); }
