import { describe, it, expect, beforeEach } from 'vitest';
import { db as prisma, resetDb, createIdentity } from '@/test/util';
import {
  updateTranslation,
  createContentKey,
  getContentKey,
  listContentKeys,
  listNamespaces,
  exportToCSV,
  importFromCSV,
} from './edit.service';

describe('Content edit service', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('createContentKey', () => {
    it('creates a content key with translations', async () => {
      const admin = await createIdentity({ isAdmin: true });

      const key = await createContentKey(prisma, {
        key: 'booking.widget.cta',
        namespace: 'booking',
        description: 'Call-to-action button in the booking widget',
        initialTranslations: {
          ru: 'Забронировать',
          en: 'Book now',
          th: 'จองเลย',
        },
        identityId: admin.id,
      });

      expect(key.key).toBe('booking.widget.cta');
      expect(key.namespace).toBe('booking');
      expect((key as any).translations).toHaveLength(3);
    });

    it('rejects duplicate key', async () => {
      const admin = await createIdentity({ isAdmin: true });

      await createContentKey(prisma, {
        key: 'booking.widget.cta',
        namespace: 'booking',
        description: 'Call-to-action',
        initialTranslations: { ru: 'Забронировать' },
        identityId: admin.id,
      });

      await expect(
        createContentKey(prisma, {
          key: 'booking.widget.cta',
          namespace: 'booking',
          description: 'Call-to-action',
          initialTranslations: { ru: 'Забронировать' },
          identityId: admin.id,
        })
      ).rejects.toThrow('already exists');
    });

    it('rejects mismatched placeholders', async () => {
      const admin = await createIdentity({ isAdmin: true });

      await expect(
        createContentKey(prisma, {
          key: 'booking.confirmation',
          namespace: 'booking',
          description: 'Confirmation message',
          initialTranslations: {
            ru: 'Ваше бронирование в {project} подтверждено',
            en: 'Your booking confirmed', // Missing {project} placeholder
            th: 'การจองของคุณใน {project} ได้รับการยืนยันแล้ว',
          },
          identityId: admin.id,
        })
      ).rejects.toThrow('Placeholder mismatch');
    });
  });

  describe('updateTranslation', () => {
    it('updates an existing translation', async () => {
      const admin = await createIdentity({ isAdmin: true });

      const key = await createContentKey(prisma, {
        key: 'test.key',
        namespace: 'test',
        description: 'Test key',
        initialTranslations: {
          ru: 'Текст',
          en: 'Text',
          th: 'ข้อความ',
        },
        identityId: admin.id,
      });

      await updateTranslation(prisma, {
        contentKeyId: key.id,
        locale: 'en',
        value: 'Updated text',
        identityId: admin.id,
      });

      const updated = await getContentKey(prisma, key.id);
      const enTrans = (updated as any).translations.find((t: any) => t.locale === 'en');
      expect(enTrans.value).toBe('Updated text');
    });

    it('blocks placeholder mismatch on update', async () => {
      const admin = await createIdentity({ isAdmin: true });

      const key = await createContentKey(prisma, {
        key: 'with.placeholder',
        namespace: 'test',
        description: 'Key with placeholder',
        initialTranslations: {
          ru: 'Привет {name}',
          en: 'Hello {name}',
          th: 'สวัสดี {name}',
        },
        identityId: admin.id,
      });

      // Try to update without the placeholder
      await expect(
        updateTranslation(prisma, {
          contentKeyId: key.id,
          locale: 'en',
          value: 'Hello world', // Missing {name}
          identityId: admin.id,
        })
      ).rejects.toThrow('Placeholder mismatch');
    });

    it('allows update with matching placeholders', async () => {
      const admin = await createIdentity({ isAdmin: true });

      const key = await createContentKey(prisma, {
        key: 'with.placeholder',
        namespace: 'test',
        description: 'Key with placeholder',
        initialTranslations: {
          ru: 'Привет {name}',
          en: 'Hello {name}',
          th: 'สวัสดี {name}',
        },
        identityId: admin.id,
      });

      await updateTranslation(prisma, {
        contentKeyId: key.id,
        locale: 'en',
        value: 'Hi {name}',
        identityId: admin.id,
      });

      const updated = await getContentKey(prisma, key.id);
      const enTrans = (updated as any).translations.find((t: any) => t.locale === 'en');
      expect(enTrans.value).toBe('Hi {name}');
    });

    it('allows multiple named placeholders', async () => {
      const admin = await createIdentity({ isAdmin: true });

      const key = await createContentKey(prisma, {
        key: 'booking.details',
        namespace: 'booking',
        description: 'Booking details',
        initialTranslations: {
          ru: '{project} на {date} для {guests} гостей',
          en: '{project} on {date} for {guests} guests',
          th: '{project} เมื่อ {date} สำหรับ {guests} ท่าน',
        },
        identityId: admin.id,
      });

      expect(key.id).toBeDefined();

      const fetched = await getContentKey(prisma, key.id);
      expect((fetched as any).translations).toHaveLength(3);
    });
  });

  describe('listContentKeys', () => {
    it('lists keys by namespace', async () => {
      const admin = await createIdentity({ isAdmin: true });

      await createContentKey(prisma, {
        key: 'booking.widget.cta',
        namespace: 'booking',
        description: 'CTA button',
        initialTranslations: { ru: 'Забронировать' },
        identityId: admin.id,
      });

      await createContentKey(prisma, {
        key: 'booking.error.dates_taken',
        namespace: 'booking',
        description: 'Dates unavailable error',
        initialTranslations: { ru: 'Даты заняты' },
        identityId: admin.id,
      });

      const keys = await listContentKeys(prisma, 'booking');
      expect(keys).toHaveLength(2);
      expect(keys.map(k => k.key).sort()).toEqual([
        'booking.error.dates_taken',
        'booking.widget.cta',
      ]);
    });

    it('filters by search term', async () => {
      const admin = await createIdentity({ isAdmin: true });

      await createContentKey(prisma, {
        key: 'booking.widget.cta',
        namespace: 'booking',
        description: 'Call-to-action button',
        initialTranslations: { ru: 'Забронировать' },
        identityId: admin.id,
      });

      await createContentKey(prisma, {
        key: 'booking.error.dates_taken',
        namespace: 'booking',
        description: 'Dates unavailable',
        initialTranslations: { ru: 'Даты заняты' },
        identityId: admin.id,
      });

      const keys = await listContentKeys(prisma, 'booking', { search: 'button' });
      expect(keys).toHaveLength(1);
      expect(keys[0].key).toBe('booking.widget.cta');
    });

    it('filters by needs_review status', async () => {
      const admin = await createIdentity({ isAdmin: true });

      const key1 = await createContentKey(prisma, {
        key: 'test.key1',
        namespace: 'test',
        description: 'Key 1',
        initialTranslations: { ru: 'Текст' },
        identityId: admin.id,
      });

      await createContentKey(prisma, {
        key: 'test.key2',
        namespace: 'test',
        description: 'Key 2',
        initialTranslations: { ru: 'Текст 2' },
        identityId: admin.id,
      });

      // Manually update one translation to mark it as ok
      await prisma.translation.update({
        where: { contentKeyId_locale: { contentKeyId: key1.id, locale: 'ru' } },
        data: { status: 'ok' },
      });

      const needsReview = await listContentKeys(prisma, 'test', { status: 'needs_review' });
      expect(needsReview).toHaveLength(1);
      expect(needsReview[0].key).toBe('test.key2');
    });
  });

  describe('listNamespaces', () => {
    it('lists all namespaces', async () => {
      const admin = await createIdentity({ isAdmin: true });

      await createContentKey(prisma, {
        key: 'booking.cta',
        namespace: 'booking',
        description: 'Booking CTA',
        initialTranslations: { ru: 'Забронировать' },
        identityId: admin.id,
      });

      await createContentKey(prisma, {
        key: 'auth.login',
        namespace: 'auth',
        description: 'Login button',
        initialTranslations: { ru: 'Войти' },
        identityId: admin.id,
      });

      const namespaces = await listNamespaces(prisma);
      expect(namespaces).toContain('booking');
      expect(namespaces).toContain('auth');
    });
  });

  describe('CSV export/import', () => {
    it('exports content keys to CSV', async () => {
      const admin = await createIdentity({ isAdmin: true });

      await createContentKey(prisma, {
        key: 'test.key1',
        namespace: 'test',
        description: 'First key',
        initialTranslations: {
          ru: 'Первый',
          en: 'First',
          th: 'แรก',
        },
        identityId: admin.id,
      });

      const csv = await exportToCSV(prisma, 'test');

      expect(csv).toContain('key');
      expect(csv).toContain('test.key1');
      expect(csv).toContain('Первый');
      expect(csv).toContain('First');
    });

    it('imports content keys from CSV', async () => {
      const admin = await createIdentity({ isAdmin: true });

      const csv = `"key","description","ru","en","th","status_ru","status_en","status_th"
"test.import1","Test import 1","Текст 1","Text 1","ข้อความ 1","needs_review","needs_review","needs_review"
"test.import2","Test import 2","Текст 2","Text 2","ข้อความ 2","needs_review","needs_review","needs_review"`;

      const result = await importFromCSV(prisma, 'test', csv, admin.id);

      expect(result.created).toBe(2);
      expect(result.updated).toBe(0);
      expect(result.errors).toHaveLength(0);

      const keys = await listContentKeys(prisma, 'test');
      expect(keys).toHaveLength(2);
    });

    it('imports updates existing keys', async () => {
      const admin = await createIdentity({ isAdmin: true });

      await createContentKey(prisma, {
        key: 'test.existing',
        namespace: 'test',
        description: 'Existing key',
        initialTranslations: {
          ru: 'Старый текст',
          en: 'Old text',
          th: 'ข้อความเก่า',
        },
        identityId: admin.id,
      });

      const csv = `"key","description","ru","en","th"
"test.existing","Existing key","Новый текст","New text","ข้อความใหม่"
"test.new","New key","Новый","New","ใหม่"`;

      const result = await importFromCSV(prisma, 'test', csv, admin.id);

      expect(result.created).toBe(1);
      expect(result.updated).toBe(1);

      const keys = await listContentKeys(prisma, 'test');
      expect(keys).toHaveLength(2);
    });
  });
});
