/**
 * Fix legal pages Russian content corruption
 *
 * Issue: 15 legal content keys have Thai/Indonesian text in the ru field instead of Russian
 * Action: Clear broken Russian values and mark for review
 */

import { PrismaClient } from '@prisma/client';

async function fixLegalContent() {
  const prisma = new PrismaClient();
  console.log('[FIX] Starting legal content Russian field repair...\n');

  try {
    // Check current state
    const broken = await prisma.contentKey.findMany({
      where: {
        namespace: 'legal',
        OR: [
          { value_ru: { contains: 'ระ' } },
          { value_ru: { contains: 'ต' } },
          { value_ru: { contains: '[COUNSEL' } },
        ],
      },
      select: { id: true, key: true, value_ru: true },
    });

    console.log(`📋 Found ${broken.length} broken legal content keys:\n`);
    broken.forEach((item) => {
      const preview = item.value_ru?.slice(0, 60).replace(/\n/g, ' ') || '[empty]';
      console.log(`  • ${item.key}: "${preview}..."`);
    });

    if (broken.length === 0) {
      console.log('✅ No broken Russian values found — already fixed or not present');
      return;
    }

    // Fix: Clear broken values
    const updated = await prisma.contentKey.updateMany({
      where: {
        namespace: 'legal',
        OR: [
          { value_ru: { contains: 'ระ' } },
          { value_ru: { contains: 'ต' } },
          { value_ru: { contains: '[COUNSEL' } },
        ],
      },
      data: {
        value_ru: null,
        needs_review: true,
        updated_at: new Date(),
      },
    });

    console.log(`\n✅ Fixed ${updated.count} keys:\n`);
    console.log('  → Set value_ru = NULL (requires Russian translation)');
    console.log('  → Marked needs_review = true (blocks deployment until approved)');

    // Verify results
    const stillBroken = await prisma.contentKey.findMany({
      where: {
        namespace: 'legal',
        OR: [
          { value_ru: { contains: 'ระ' } },
          { value_ru: { contains: 'ต' } },
          { value_ru: { contains: '[COUNSEL' } },
        ],
      },
      select: { key: true },
    });

    if (stillBroken.length === 0) {
      console.log('\n🎯 Verification: All broken Russian values cleared\n');
    } else {
      console.log(`\n⚠️  Warning: ${stillBroken.length} keys still have issues\n`);
    }

    // Show what needs Russian translation
    const needsRu = await prisma.contentKey.findMany({
      where: {
        namespace: 'legal',
        value_ru: null,
      },
      select: { key: true, value_en: true },
      orderBy: { key: 'asc' },
    });

    console.log(`📝 ${needsRu.length} legal keys need Russian translations:\n`);
    needsRu.forEach((item) => {
      const enPreview = item.value_en?.slice(0, 50) || '[empty]';
      console.log(`  • ${item.key}`);
      console.log(`    EN: "${enPreview}..."`);
    });
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
