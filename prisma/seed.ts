import { PrismaClient } from '@prisma/client';
import { seedConfig } from '../src/modules/config/seed';

const db = new PrismaClient();

async function main() {
  try {
    console.log('Starting seed...');
    await seedConfig(db);
    console.log('✓ Seed completed successfully');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
