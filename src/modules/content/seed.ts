/**
 * Seed content keys and translations for the common.* namespace
 * This is called during database initialization
 */

import { PrismaClient } from '@prisma/client';
import { ensureContentKey, setTranslation } from './content.service';
import { Locale } from './types';

interface KeyDef {
  key: string;
  namespace: string;
  description: string;
  supportsRich?: boolean;
  ru: string;
  en: string;
  th: string;
}

const COMMON_KEYS: KeyDef[] = [
  // Actions
  {
    key: 'common.action.save',
    namespace: 'common',
    description: 'Button: save changes',
    ru: 'Сохранить',
    en: 'Save',
    th: 'บันทึก',
  },
  {
    key: 'common.action.cancel',
    namespace: 'common',
    description: 'Button: cancel action',
    ru: 'Отменить',
    en: 'Cancel',
    th: 'ยกเลิก',
  },
  {
    key: 'common.action.confirm',
    namespace: 'common',
    description: 'Button: confirm action',
    ru: 'Подтвердить',
    en: 'Confirm',
    th: 'ยืนยัน',
  },
  {
    key: 'common.action.back',
    namespace: 'common',
    description: 'Button: go back',
    ru: 'Назад',
    en: 'Back',
    th: 'ย้อนกลับ',
  },
  {
    key: 'common.action.continue',
    namespace: 'common',
    description: 'Button: continue',
    ru: 'Далее',
    en: 'Continue',
    th: 'ต่อไป',
  },
  {
    key: 'common.action.close',
    namespace: 'common',
    description: 'Button: close dialog',
    ru: 'Закрыть',
    en: 'Close',
    th: 'ปิด',
  },
  {
    key: 'common.action.edit',
    namespace: 'common',
    description: 'Button: edit item',
    ru: 'Редактировать',
    en: 'Edit',
    th: 'แก้ไข',
  },
  {
    key: 'common.action.delete',
    namespace: 'common',
    description: 'Button: delete item',
    ru: 'Удалить',
    en: 'Delete',
    th: 'ลบ',
  },
  {
    key: 'common.action.search',
    namespace: 'common',
    description: 'Button: search',
    ru: 'Поиск',
    en: 'Search',
    th: 'ค้นหา',
  },
  {
    key: 'common.action.filter',
    namespace: 'common',
    description: 'Button: open filters',
    ru: 'Фильтры',
    en: 'Filter',
    th: 'ตัวกรอง',
  },

  // Booking statuses
  {
    key: 'common.status.booking.pending_payment',
    namespace: 'common',
    description: 'Booking status: awaiting payment',
    ru: 'Ожидание оплаты',
    en: 'Awaiting Payment',
    th: 'รอการชำระเงิน',
  },
  {
    key: 'common.status.booking.confirmed',
    namespace: 'common',
    description: 'Booking status: confirmed',
    ru: 'Подтверждено',
    en: 'Confirmed',
    th: 'ยืนยันแล้ว',
  },
  {
    key: 'common.status.booking.requested',
    namespace: 'common',
    description: 'Booking status: request awaiting approval',
    ru: 'На рассмотрении',
    en: 'Requested',
    th: 'อยู่ระหว่างการพิจารณา',
  },
  {
    key: 'common.status.booking.declined',
    namespace: 'common',
    description: 'Booking status: declined',
    ru: 'Отклонено',
    en: 'Declined',
    th: 'ปฏิเสธแล้ว',
  },
  {
    key: 'common.status.booking.cancelled',
    namespace: 'common',
    description: 'Booking status: cancelled',
    ru: 'Отменено',
    en: 'Cancelled',
    th: 'ยกเลิกแล้ว',
  },

  // Engagement types
  {
    key: 'common.engagement.direct',
    namespace: 'common',
    description: 'Engagement type: directly managed by owner',
    ru: 'Прямое управление',
    en: 'Direct',
    th: 'การจัดการโดยตรง',
  },
  {
    key: 'common.engagement.via_mc',
    namespace: 'common',
    description: 'Engagement type: via management company',
    ru: 'Через УК',
    en: 'Management Company',
    th: 'ผ่านบริษัทจัดการ',
  },
  {
    key: 'common.engagement.owner_direct',
    namespace: 'common',
    description: 'Engagement type: owner-managed stays',
    ru: 'Владелец владеет',
    en: 'Owner-Direct',
    th: 'เจ้าของจัดการ',
  },

  // Unit statuses
  {
    key: 'common.status.unit.draft',
    namespace: 'common',
    description: 'Unit status: not yet live',
    ru: 'Черновик',
    en: 'Draft',
    th: 'ร่างฉบับ',
  },
  {
    key: 'common.status.unit.active',
    namespace: 'common',
    description: 'Unit status: live and bookable',
    ru: 'Активно',
    en: 'Active',
    th: 'ใช้งานอยู่',
  },
  {
    key: 'common.status.unit.inactive',
    namespace: 'common',
    description: 'Unit status: temporarily unavailable',
    ru: 'Неактивно',
    en: 'Inactive',
    th: 'ไม่ใช้งาน',
  },

  // Dates and durations
  {
    key: 'common.date.night',
    namespace: 'common',
    description: 'Singular: one night',
    ru: 'ночь',
    en: 'night',
    th: 'คืน',
  },
  {
    key: 'common.date.nights',
    namespace: 'common',
    description: 'Plural: multiple nights',
    ru: 'ночей',
    en: 'nights',
    th: 'คืน',
  },

  // Empty/Loading/Error states
  {
    key: 'common.state.empty.title',
    namespace: 'common',
    description: 'Empty state: no results title',
    ru: 'Ничего не найдено',
    en: 'No Results',
    th: 'ไม่พบผลลัพธ์',
  },
  {
    key: 'common.state.empty.description',
    namespace: 'common',
    description: 'Empty state: no results description',
    ru: 'Попробуйте изменить критерии поиска',
    en: 'Try adjusting your search criteria',
    th: 'ลองปรับเปลี่ยนเกณฑ์การค้นหา',
  },
  {
    key: 'common.state.loading',
    namespace: 'common',
    description: 'Loading state: generic loading message',
    ru: 'Загрузка...',
    en: 'Loading...',
    th: 'กำลังโหลด...',
  },
  {
    key: 'common.state.error.title',
    namespace: 'common',
    description: 'Error state: something went wrong title',
    ru: 'Ошибка',
    en: 'Error',
    th: 'ข้อผิดพลาด',
  },
  {
    key: 'common.state.error.description',
    namespace: 'common',
    description: 'Error state: please try again description',
    ru: 'Пожалуйста, попробуйте снова',
    en: 'Please try again',
    th: 'โปรดลองอีกครั้ง',
  },

  // Roles
  {
    key: 'common.role.owner',
    namespace: 'common',
    description: 'Role: property owner',
    ru: 'Владелец',
    en: 'Owner',
    th: 'เจ้าของ',
  },
  {
    key: 'common.role.guest',
    namespace: 'common',
    description: 'Role: guest/resident',
    ru: 'Гость',
    en: 'Guest',
    th: 'แขก',
  },
  {
    key: 'common.role.resident',
    namespace: 'common',
    description: 'Role: long-term resident',
    ru: 'Резидент',
    en: 'Resident',
    th: 'ผู้พักอาศัย',
  },
  {
    key: 'common.role.staff',
    namespace: 'common',
    description: 'Role: staff member',
    ru: 'Персонал',
    en: 'Staff',
    th: 'พนักงาน',
  },
  {
    key: 'common.role.provider',
    namespace: 'common',
    description: 'Role: service provider',
    ru: 'Поставщик услуг',
    en: 'Provider',
    th: 'ผู้ให้บริการ',
  },
  {
    key: 'common.role.admin',
    namespace: 'common',
    description: 'Role: administrator',
    ru: 'Администратор',
    en: 'Administrator',
    th: 'ผู้ดูแลระบบ',
  },
];

export async function seedContent(
  db: PrismaClient,
  systemIdentityId?: string
): Promise<void> {
  const identityId = systemIdentityId || 'system';

  for (const keyDef of COMMON_KEYS) {
    // Ensure content key exists
    await ensureContentKey(
      db,
      keyDef.key,
      keyDef.namespace,
      keyDef.description,
      keyDef.supportsRich || false
    );

    // Set translations for all locales
    const locales: Locale[] = ['ru', 'en', 'th'];
    for (const locale of locales) {
      const value = keyDef[locale];
      await setTranslation(
        db,
        keyDef.key,
        locale,
        value,
        'ok',
        identityId
      );
    }
  }
}
