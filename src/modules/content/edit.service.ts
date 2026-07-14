import { PrismaClient, ContentKey } from '@prisma/client';

interface UpdateTranslationInput {
  contentKeyId: string;
  locale: string;
  value: string;
  identityId: string;
}

interface CreateContentKeyInput {
  key: string;
  namespace: string;
  description: string;
  supportsRich?: boolean;
  initialTranslations?: Record<string, string>; // { ru: 'text', en: 'text', th: 'text' }
  identityId: string;
}

/**
 * Extract ICU placeholder names from a translation value
 * Matches {name} and {name, plural, ...} patterns
 */
function extractPlaceholders(value: string): Set<string> {
  const placeholders = new Set<string>();
  const regex = /\{([a-zA-Z_][a-zA-Z0-9_]*)/g;
  let match;
  while ((match = regex.exec(value)) !== null) {
    placeholders.add(match[1]);
  }
  return placeholders;
}

/**
 * Validate that all translations have the same set of placeholders
 */
function validatePlaceholders(
  translations: Record<string, string>
): { valid: boolean; error?: string } {
  const locales = Object.keys(translations);
  if (locales.length === 0) {
    return { valid: true };
  }

  const firstLocale = locales[0];
  const expectedPlaceholders = extractPlaceholders(translations[firstLocale]);

  for (const locale of locales.slice(1)) {
    const currentPlaceholders = extractPlaceholders(translations[locale]);
    const expected = Array.from(expectedPlaceholders).sort().join(',');
    const current = Array.from(currentPlaceholders).sort().join(',');

    if (expected !== current) {
      return {
        valid: false,
        error: `Placeholder mismatch in ${locale}: expected {${Array.from(expectedPlaceholders).join('}, {')}} but got {${Array.from(currentPlaceholders).join('}, {')}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Update a translation and audit-log the change
 */
export async function updateTranslation(
  db: PrismaClient,
  input: UpdateTranslationInput
): Promise<void> {
  const { contentKeyId, locale, value, identityId } = input;

  // Get the content key with all translations
  const contentKey = await db.contentKey.findUnique({
    where: { id: contentKeyId },
    include: { translations: true },
  });

  if (!contentKey) {
    throw new Error(`Content key ${contentKeyId} not found`);
  }

  // Build translations map for validation (old values + new value)
  const translationsMap: Record<string, string> = {};
  for (const trans of contentKey.translations) {
    translationsMap[trans.locale] = trans.locale === locale ? value : trans.value;
  }

  // Validate placeholders
  const validation = validatePlaceholders(translationsMap);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid placeholders');
  }

  // Determine status based on whether it's a draft/needs_review or finalized
  // If it's marked needs_review, editing it keeps it as needs_review
  // If it's ok, editing it keeps it ok
  const existingTranslation = contentKey.translations.find(t => t.locale === locale);
  const newStatus = existingTranslation?.status || 'ok';

  // Update or create the translation
  await db.translation.upsert({
    where: {
      contentKeyId_locale: {
        contentKeyId,
        locale,
      },
    },
    update: {
      value,
      status: newStatus,
      updatedByIdentityId: identityId,
    },
    create: {
      contentKeyId,
      locale,
      value,
      status: newStatus,
      updatedByIdentityId: identityId,
    },
  });
}

/**
 * Create a new content key with initial translations
 */
export async function createContentKey(
  db: PrismaClient,
  input: CreateContentKeyInput
): Promise<ContentKey> {
  const { key, namespace, description, supportsRich = false, initialTranslations = {}, identityId } = input;

  // Check if key already exists
  const existing = await db.contentKey.findUnique({ where: { key } });
  if (existing) {
    throw new Error(`Content key "${key}" already exists`);
  }

  // Validate placeholders if there are translations
  if (Object.keys(initialTranslations).length > 0) {
    const validation = validatePlaceholders(initialTranslations);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid placeholders');
    }
  }

  // Create the key with translations
  const created = await db.contentKey.create({
    data: {
      key,
      namespace,
      description,
      supportsRich,
      translations: {
        create: Object.entries(initialTranslations).map(([locale, value]) => ({
          locale,
          value,
          status: 'needs_review',
          updatedByIdentityId: identityId,
        })),
      },
    },
    include: { translations: true },
  });

  return created as any;
}

/**
 * Get a content key with all translations
 */
export async function getContentKey(
  db: PrismaClient,
  keyId: string
): Promise<ContentKey | null> {
  const key = await db.contentKey.findUnique({
    where: { id: keyId },
    include: {
      translations: {
        include: { updatedBy: { select: { id: true, email: true, firstName: true, lastName: true } } },
      },
    },
  });
  return key as any;
}

/**
 * Get all content keys for a namespace with optional filters
 */
export async function listContentKeys(
  db: PrismaClient,
  namespace: string,
  filters?: {
    status?: string; // 'needs_review', 'missing_th', etc.
    search?: string; // Search in key or description
  }
): Promise<ContentKey[]> {
  let where: any = { namespace };

  if (filters?.search) {
    where.OR = [
      { key: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const keys = await db.contentKey.findMany({
    where,
    include: { translations: true },
    orderBy: { key: 'asc' },
  });

  // Apply status filter if specified
  if (filters?.status) {
    if (filters.status === 'needs_review') {
      return keys.filter(k => k.translations.some(t => t.status === 'needs_review'));
    }
    if (filters.status === 'missing_th') {
      return keys.filter(k => !k.translations.some(t => t.locale === 'th'));
    }
    if (filters.status === 'missing_en') {
      return keys.filter(k => !k.translations.some(t => t.locale === 'en'));
    }
  }

  return keys as any;
}

/**
 * Get all namespaces
 */
export async function listNamespaces(db: PrismaClient): Promise<string[]> {
  const keys = await db.contentKey.findMany({
    select: { namespace: true },
    distinct: ['namespace'],
    orderBy: { namespace: 'asc' },
  });
  return keys.map(k => k.namespace);
}

/**
 * Export content keys as CSV
 */
export async function exportToCSV(db: PrismaClient, namespace: string): Promise<string> {
  const keys = await listContentKeys(db, namespace);

  // CSV header: key, description, ru, en, th, status_ru, status_en, status_th
  const rows = [['key', 'description', 'ru', 'en', 'th', 'status_ru', 'status_en', 'status_th']];

  for (const key of keys as any) {
    const translations: Record<string, any> = {};
    const statuses: Record<string, any> = {};

    for (const trans of (key.translations as any)) {
      translations[trans.locale] = trans.value;
      statuses[trans.locale] = trans.status;
    }

    rows.push([
      key.key,
      key.description,
      translations['ru'] || '',
      translations['en'] || '',
      translations['th'] || '',
      statuses['ru'] || 'missing',
      statuses['en'] || 'missing',
      statuses['th'] || 'missing',
    ]);
  }

  // Convert to CSV (simple CSV without quoting for now)
  return rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
}

/**
 * Import content keys from CSV
 */
export async function importFromCSV(
  db: PrismaClient,
  namespace: string,
  csvContent: string,
  identityId: string
): Promise<{ created: number; updated: number; errors: string[] }> {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV must have header and at least one data row');
  }

  const errors: string[] = [];
  let created = 0;
  let updated = 0;

  // Parse header
  const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const keyIndex = header.indexOf('key');
  const descIndex = header.indexOf('description');
  const ruIndex = header.indexOf('ru');
  const enIndex = header.indexOf('en');
  const thIndex = header.indexOf('th');

  if (keyIndex === -1 || descIndex === -1) {
    throw new Error('CSV must have "key" and "description" columns');
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cells.length < keyIndex + 1) continue;

    const key = cells[keyIndex];
    const description = cells[descIndex];
    const ru = ruIndex >= 0 ? cells[ruIndex] : '';
    const en = enIndex >= 0 ? cells[enIndex] : '';
    const th = thIndex >= 0 ? cells[thIndex] : '';

    if (!key || !description) continue;

    try {
      // Check if key exists
      const existing = await db.contentKey.findUnique({ where: { key } });

      if (existing) {
        // Update translations only
        for (const [locale, value] of Object.entries({ ru, en, th })) {
          if (value) {
            await updateTranslation(db, {
              contentKeyId: existing.id,
              locale,
              value,
              identityId,
            });
          }
        }
        updated++;
      } else {
        // Create new key
        await createContentKey(db, {
          key,
          namespace,
          description,
          initialTranslations: { ru, en, th },
          identityId,
        });
        created++;
      }
    } catch (error: any) {
      errors.push(`Row ${i + 1}: ${error.message}`);
    }
  }

  return { created, updated, errors };
}
