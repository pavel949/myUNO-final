-- Fix Legal Pages Russian Content Keys
--
-- CRITICAL: The Russian (value_ru) field for legal pages contains Thai/Indonesian text instead of Russian.
-- This script CLEARS the broken Russian field so a proper Russian translation can be added.
--
-- Usage:
--   1. Review the backup query below to ensure you're clearing the right records
--   2. Copy the BACKUP query and run it first to see which records will be affected
--   3. Provide Russian translations for each key
--   4. Then run the UPDATE query
--   5. Verify the results with the VERIFICATION query

-- BACKUP: Check current state before making changes
-- Run this first to see what's in the database:
SELECT key, value_ru, value_en, value_th, namespace, needs_review, updated_at
FROM "Content"
WHERE namespace = 'legal'
  AND (value_ru ILIKE '%ระ%' OR value_ru ILIKE '%ต%' OR value_ru LIKE '%[COUNSEL%')
ORDER BY key;

-- FIX: Clear the broken Russian values (set to NULL)
-- This prevents broken Thai/Indonesian from being displayed to Russian users
UPDATE "Content"
SET
  value_ru = NULL,
  needs_review = true,
  updated_at = NOW()
WHERE namespace = 'legal'
  AND (value_ru ILIKE '%ระ%' OR value_ru ILIKE '%ต%' OR value_ru LIKE '%[COUNSEL%');

-- VERIFICATION: Confirm which legal keys now need Russian translations
-- Run this after the fix to see what needs to be done:
SELECT
  key,
  CASE WHEN value_ru IS NULL THEN '❌ NEEDS RU TRANSLATION' ELSE '✅ HAS RU' END as ru_status,
  COALESCE(LEFT(value_en, 50), '[NO EN]') as en_preview,
  needs_review
FROM "Content"
WHERE namespace = 'legal'
ORDER BY key;

-- ROLLBACK (if needed): Restore previous state
-- Save this for emergencies, but remember: to undo, you'd need to know the original Russian content
-- For now, a fresh seed of legal pages would be the cleanest reset
