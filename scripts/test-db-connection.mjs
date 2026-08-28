#!/usr/bin/env node
/**
 * Test database connection before deployment
 *
 * Verifies that DATABASE_URL is reachable and formatted correctly.
 * Run before pushing to Vercel to catch connection issues early.
 *
 * Usage:
 *   node scripts/test-db-connection.mjs
 *   DATABASE_URL="..." node scripts/test-db-connection.mjs
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

console.log('🔍 Testing database connection...\n');

// Extract connection details
const url = new URL(dbUrl.replace('postgresql://', 'http://'));
const host = url.hostname;
const port = url.port || '5432';

console.log('Connection Details:');
console.log(`  Host: ${host}`);
console.log(`  Port: ${port}`);
console.log(`  Type: ${host.includes('pooler') ? '✅ Session Pooler' : '⚠️  Direct Connection'}`);

// Check for pooler vs direct
if (!host.includes('pooler')) {
  console.warn('\n⚠️  WARNING: Using direct connection instead of session pooler');
  console.warn('  This will FAIL in Vercel build environment.');
  console.warn('  Change to: db.XXXXXXX.pooler.supabase.com (not .supabase.co)');
}

console.log('\nTesting connection...');

// Use psql to test if available
try {
  // Mask the password in output
  const maskedUrl = dbUrl.replace(/:[^@]+@/, ':****@');
  console.log(`  Testing: ${maskedUrl}`);

  const { stdout } = await execAsync(`psql "${dbUrl}" -c "SELECT 1;"`, { timeout: 5000 });

  console.log('✅ Database connection successful!\n');
  console.log('Ready to deploy to Vercel.');
  process.exit(0);
} catch (error) {
  if (error.code === 127) {
    // psql not installed
    console.warn('⚠️  psql not installed; cannot test connection');
    console.log('   Install PostgreSQL client tools or test after deployment');
    process.exit(0);
  }

  console.error(`❌ Connection failed: ${error.message}\n`);

  if (error.message.includes('ECONNREFUSED')) {
    console.error('Likely causes:');
    console.error('  1. Database server is down');
    console.error('  2. Connection string is incorrect');
    console.error('  3. Using direct connection (.supabase.co) instead of pooler (.pooler.supabase.com)');
  } else if (error.message.includes('ETIMEDOUT') || error.message.includes('timeout')) {
    console.error('Likely causes:');
    console.error('  1. Firewall blocking connection');
    console.error('  2. Using direct connection from Vercel build environment');
    console.error('     → Change to .pooler.supabase.com');
    console.error('  3. Network latency');
  }

  process.exit(1);
}
