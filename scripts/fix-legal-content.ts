/**
 * Fix legal pages Russian content corruption
 *
 * Issue: Legal content keys have corrupted Russian translations
 * Schema: ContentKey + Translation (one per locale)
 * Action: Clear broken Russian values and mark for review
 */

import { PrismaClient } from '@prisma/client';

async function fixLegalContent() {
  const prisma = new PrismaClient();
  console.log('[FIX] Starting legal content Russian translation repair...\n');

  try {
    // Find legal keys with broken Russian translations
    const brokenRu = await prisma.translation.findMany({
      where: {
        locale: 'ru',
        contentKey: { namespace: 'legal' },
        OR: [
          { value: { contains: 'ระ' } }, // Thai chars
          { value: { contains: 'ต' } },
          { value: { contains: '[COUNSEL' } }, // Placeholder
        ],
      },
      include: {
        contentKey: { select: { key: true } },
      },
    });

    console.log(`📋 Found ${brokenRu.length} broken Russian translations:\n`);
    brokenRu.forEach((trans) => {
      const preview = trans.value.slice(0, 60).replace(/\n/g, ' ');
      console.log(`  • ${trans.contentKey.key}: "${preview}..."`);
    });

    if (brokenRu.length === 0) {
      console.log('✅ No broken Russian translations found — already fixed or not present');
      return;
    }

    // Fix: Delete broken Russian translations (they'll show as untranslated)
    const deleteCount = await prisma.translation.deleteMany({
      where: {
        id: { in: brokenRu.map((t) => t.id) },
      },
    });

    console.log(`\n✅ Deleted ${deleteCount.count} broken Russian translations:\n`);
    console.log('  → Removed corrupted Thai/Indonesian text from Russian field');
    console.log('  → Keys now show as untranslated for Russian locale');
    console.log('  → Next: Provide proper Russian translations via admin content editor');

    // Show what needs Russian translation
    const legalKeys = await prisma.contentKey.findMany({
      where: { namespace: 'legal' },
      select: { key: true, id: true },
      orderBy: { key: 'asc' },
    });

    console.log(`\n📝 Legal namespace contains ${legalKeys.length} content keys:\n`);

    const withRu = await prisma.translation.findMany({
      where: {
        locale: 'ru',
        contentKey: { namespace: 'legal' },
      },
      select: { contentKeyId: true },
    });

    const ruKeyIds = new Set(withRu.map((t) => t.contentKeyId));

    const needsRu = legalKeys.filter((k) => !ruKeyIds.has(k.id));
    console.log(`  ⚠️  ${needsRu.length} keys need Russian translations:`);
    needsRu.slice(0, 10).forEach((k) => {
      console.log(`     • ${k.key}`);
    });
    if (needsRu.length > 10) {
      console.log(`     ... and ${needsRu.length - 10} more`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

(async () => {
  try {
    await fixLegalContent();
    console.log('\n✅ Legal content fix complete');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Error:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
})();
