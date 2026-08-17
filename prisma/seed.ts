import { PrismaClient } from '@prisma/client';
import { seedConfig } from '../src/modules/config/seed';
import { seedContent } from '../src/modules/content/seed';
import { seedAudienceFAQs } from '../src/modules/content/audience-faq.seed';
import { seedLegalPages } from '../src/modules/content/legal-pages.seed';
import { seedDemoData } from '../src/modules/core/seed';
import { seedLayantara } from '../src/modules/core/layantara.seed';
import { seedWalkthroughState } from '../src/modules/core/walkthrough.seed';

const db = new PrismaClient();

async function main() {
  try {
    console.log('Starting seed...');
    await seedConfig(db);
    console.log('✓ Config seeded');
    await seedContent(db);
    console.log('✓ Content seeded');
    await seedAudienceFAQs(db);
    console.log('✓ Audience FAQs seeded');
    await seedLegalPages(db);
    console.log('✓ Legal pages seeded');
    await seedDemoData(db);
    console.log('✓ Demo data seeded');
    await seedLayantara(db);
    // Last: the walkthrough state reads the cast the steps above created.
    await seedWalkthroughState(db);
    console.log('✓ Seed completed successfully');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
