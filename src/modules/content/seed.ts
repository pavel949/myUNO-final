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

  // Notification keys
  {
    key: 'notify.stay_dates_modified.title',
    namespace: 'notify',
    description: 'Notification: stay dates modified',
    ru: 'Даты вашего проживания изменены',
    en: 'Your stay dates have been modified',
    th: 'วันที่พักของคุณถูกเปลี่ยนแปลง',
  },
  {
    key: 'notify.stay_dates_modified.body',
    namespace: 'notify',
    description: 'Notification: stay dates modified details',
    ru: 'Ваше бронирование было обновлено новыми датами. Проверьте детали в приложении.',
    en: 'Your booking has been updated with new dates. Check the details in the app.',
    th: 'การจองของคุณได้รับการอัปเดตด้วยวันที่ใหม่ โปรดตรวจสอบรายละเอียดในแอป',
  },

  // Thread system messages
  {
    key: 'thread.system.booking_confirmed',
    namespace: 'thread',
    description: 'System message: booking confirmed',
    ru: 'Бронирование подтверждено. Платеж получен.',
    en: 'Booking confirmed. Payment received.',
    th: 'การจองได้รับการยืนยัน ชำระเงินแล้ว',
  },

  // Ticket categories
  {
    key: 'catalog.ticket_category.maintenance',
    namespace: 'catalog',
    description: 'Ticket category: maintenance',
    ru: 'Техническое обслуживание',
    en: 'Maintenance',
    th: 'การบำรุงรักษา',
  },
  {
    key: 'catalog.ticket_category.housekeeping',
    namespace: 'catalog',
    description: 'Ticket category: housekeeping',
    ru: 'Уборка',
    en: 'Housekeeping',
    th: 'การทำความสะอาด',
  },
  {
    key: 'catalog.ticket_category.complaint',
    namespace: 'catalog',
    description: 'Ticket category: complaint',
    ru: 'Жалоба',
    en: 'Complaint',
    th: 'การร้องเรียน',
  },
  {
    key: 'catalog.ticket_category.billing_question',
    namespace: 'catalog',
    description: 'Ticket category: billing question',
    ru: 'Вопрос о счете',
    en: 'Billing Question',
    th: 'คำถามเกี่ยวกับการเรียกเก็บเงิน',
  },

  // Ticket status labels
  {
    key: 'ticket.status.open',
    namespace: 'ticket',
    description: 'Ticket status: open',
    ru: 'Открыто',
    en: 'Open',
    th: 'เปิด',
  },
  {
    key: 'ticket.status.acknowledged',
    namespace: 'ticket',
    description: 'Ticket status: acknowledged',
    ru: 'Подтверждено получение',
    en: 'Acknowledged',
    th: 'ยืนยันแล้ว',
  },
  {
    key: 'ticket.status.in_progress',
    namespace: 'ticket',
    description: 'Ticket status: in progress',
    ru: 'В процессе',
    en: 'In Progress',
    th: 'กำลังดำเนินการ',
  },
  {
    key: 'ticket.status.waiting_reporter',
    namespace: 'ticket',
    description: 'Ticket status: waiting for reporter',
    ru: 'Ожидание ответа',
    en: 'Waiting for Reporter',
    th: 'รอการตอบสนอง',
  },
  {
    key: 'ticket.status.resolved',
    namespace: 'ticket',
    description: 'Ticket status: resolved',
    ru: 'Решено',
    en: 'Resolved',
    th: 'แก้ไขแล้ว',
  },
  {
    key: 'ticket.status.closed',
    namespace: 'ticket',
    description: 'Ticket status: closed',
    ru: 'Закрыто',
    en: 'Closed',
    th: 'ปิด',
  },

  // Ticket priority labels
  {
    key: 'ticket.priority.low',
    namespace: 'ticket',
    description: 'Ticket priority: low',
    ru: 'Низкий',
    en: 'Low',
    th: 'ต่ำ',
  },
  {
    key: 'ticket.priority.normal',
    namespace: 'ticket',
    description: 'Ticket priority: normal',
    ru: 'Обычный',
    en: 'Normal',
    th: 'ปกติ',
  },
  {
    key: 'ticket.priority.high',
    namespace: 'ticket',
    description: 'Ticket priority: high',
    ru: 'Высокий',
    en: 'High',
    th: 'สูง',
  },
  {
    key: 'ticket.priority.urgent',
    namespace: 'ticket',
    description: 'Ticket priority: urgent',
    ru: 'Срочный',
    en: 'Urgent',
    th: 'เร่งด่วน',
  },

  // Ticket system messages
  {
    key: 'thread.system.ticket_created',
    namespace: 'thread',
    description: 'System message: ticket created',
    ru: 'Заявка создана.',
    en: 'Ticket created.',
    th: 'ได้สร้างตั๋ว',
  },
  {
    key: 'thread.system.sla_escalated',
    namespace: 'thread',
    description: 'System message: SLA escalated',
    ru: 'SLA истек. Требуется срочное внимание.',
    en: 'SLA escalated. Urgent attention required.',
    th: 'SLA หมดลง ต้องให้ความสำคัญเร่งด่วน',
  },

  // Announcement labels
  {
    key: 'announcement.audience.everyone',
    namespace: 'announcement',
    description: 'Audience: everyone',
    ru: 'Все',
    en: 'Everyone',
    th: 'ทุกคน',
  },
  {
    key: 'announcement.audience.owners',
    namespace: 'announcement',
    description: 'Audience: owners only',
    ru: 'Только владельцы',
    en: 'Owners Only',
    th: 'เจ้าของเท่านั้น',
  },
  {
    key: 'announcement.audience.residents',
    namespace: 'announcement',
    description: 'Audience: residents only',
    ru: 'Только резиденты',
    en: 'Residents Only',
    th: 'ผู้พักอาศัยเท่านั้น',
  },
  {
    key: 'announcement.audience.guests_in_stay',
    namespace: 'announcement',
    description: 'Audience: current guests only',
    ru: 'Только текущие гости',
    en: 'Current Guests Only',
    th: 'แขกปัจจุบันเท่านั้น',
  },
  {
    key: 'announcement.audience.staff',
    namespace: 'announcement',
    description: 'Audience: staff only',
    ru: 'Только персонал',
    en: 'Staff Only',
    th: 'พนักงานเท่านั้น',
  },

  // Announcement notification (N-32)
  {
    key: 'notify.announcement_published.title',
    namespace: 'notify',
    description: 'Notification: announcement published',
    ru: 'Новое объявление',
    en: 'New Announcement',
    th: 'ประกาศใหม่',
  },
  {
    key: 'notify.announcement_published.body',
    namespace: 'notify',
    description: 'Notification: announcement published body',
    ru: '{title}. Прочитайте полный текст в приложении.',
    en: '{title}. Read the full message in the app.',
    th: '{title}. อ่านข้อความเต็มในแอป',
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
