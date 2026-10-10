/** Reviewable UI drafts; importing this file never writes or approves CMS content. */
export const UNIT_PUBLICATION_KEYS = [
  { suffix: 'title', en: 'Publication and bookings', ru: 'Публикация и бронирования', th: 'การเผยแพร่และการจอง', zh: '发布与预订' },
  { suffix: 'inquiries', en: 'Published · inquiries', ru: 'Опубликовано · обращения', th: 'เผยแพร่แล้ว · รับคำสอบถาม', zh: '已发布 · 可咨询' },
  { suffix: 'visible', en: 'Published · inquiries unavailable', ru: 'Опубликовано · обращения недоступны', th: 'เผยแพร่แล้ว · ยังรับคำสอบถามไม่ได้', zh: '已发布 · 暂不接受咨询' },
  { suffix: 'private', en: 'Not publicly visible', ru: 'Не отображается публично', th: 'ยังไม่แสดงต่อสาธารณะ', zh: '尚未公开显示' },
  { suffix: 'booking_disabled', en: 'Booking not enabled', ru: 'Бронирование не включено', th: 'ยังไม่เปิดรับการจอง', zh: '尚未开放预订' },
  { suffix: 'booking_eligibility_only', en: 'Booking eligibility detected · checkout unverified', ru: 'Условия объекта подходят · оформление брони не проверено', th: 'พบคุณสมบัติที่เข้าเกณฑ์การจอง · ยังไม่ยืนยันขั้นตอนชำระเงิน', zh: '房源符合预订条件 · 结账尚未核验' },
  { suffix: 'booking_schema_warning', en: 'This panel checks listing eligibility only. Production checkout is unverified and requires a separate database repair. Prices, dates, capacity and authority must still be checked before booking.', ru: 'Панель проверяет только условия объекта. Оформление брони в рабочей системе не проверено: требуется отдельное исправление базы данных. Цена, даты, вместимость и полномочия проверяются отдельно.', th: 'แผงนี้ตรวจเฉพาะคุณสมบัติของประกาศ ขั้นตอนชำระเงินในระบบจริงยังไม่ยืนยันและต้องแก้ไขฐานข้อมูลแยกต่างหาก ราคา วันที่ จำนวนผู้เข้าพัก และอำนาจรับจองยังต้องตรวจสอบ', zh: '本面板仅核验房源条件。生产环境结账尚未核验，需要单独修复数据库。预订前仍须核验价格、日期、人数和权限。' },
  { suffix: 'details', en: 'Details to add', ru: 'Детали для заполнения', th: 'รายละเอียดที่เพิ่มได้', zh: '待补充详情' },
  { suffix: 'details_hint', en: 'You can add these details later. Missing details do not hide an already public listing; booking activation has separate requirements.', ru: 'Эти детали можно добавить позже. Их отсутствие не скрывает уже опубликованный объект; для включения бронирования действуют отдельные требования.', th: 'เพิ่มรายละเอียดเหล่านี้ภายหลังได้ ข้อมูลที่ยังขาดไม่ทำให้ประกาศที่เผยแพร่แล้วถูกซ่อน การเปิดรับจองมีข้อกำหนดแยกต่างหาก', zh: '这些详情可稍后补充。缺失详情不会隐藏已公开的房源；开放预订另有要求。' },
  { suffix: 'description', en: 'Reviewed description', ru: 'Проверенное описание', th: 'คำบรรยายที่ตรวจสอบแล้ว', zh: '已审核的描述' },
  { suffix: 'sleeping', en: 'Bed layout', ru: 'Расположение кроватей', th: 'ผังเตียง', zh: '床位布局' },
  { suffix: 'video', en: 'Public video (optional)', ru: 'Публичное видео (необязательно)', th: 'วิดีโอสาธารณะ (ไม่บังคับ)', zh: '公开视频（可选）' },
  { suffix: 'measurements', en: 'Floor area', ru: 'Площадь', th: 'พื้นที่ใช้สอย', zh: '房屋面积' },
  { suffix: 'view', en: 'View public listing', ru: 'Открыть публичную страницу', th: 'ดูประกาศสาธารณะ', zh: '查看公开房源' },
  { suffix: 'unavailable', en: 'Publication status could not be checked. Reload to try again.', ru: 'Не удалось проверить статус публикации. Обновите страницу.', th: 'ตรวจสอบสถานะการเผยแพร่ไม่ได้ โปรดโหลดหน้าใหม่', zh: '无法核实发布状态，请刷新后重试。' },
].map(({ suffix, ...entry }) => ({ ...entry, key: `admin.unit_publication.${suffix}`, namespace: 'admin', description: 'Separate publication and booking capability display', status: 'needs_review' as const }));
export const UNIT_PUBLICATION_LABELS = Object.fromEntries(UNIT_PUBLICATION_KEYS.map(row => [row.key, row.en]));
export const UNIT_PUBLICATION_DRAFTS = Object.fromEntries(UNIT_PUBLICATION_KEYS.map(row => [row.key, { en: row.en, ru: row.ru, th: row.th, zh: row.zh }]));
