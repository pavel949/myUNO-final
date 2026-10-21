// Reviewed CMS values still win; locale drafts keep new surfaces usable before seeding.
const rows = [
  ['shared', 'Shared complex facilities', 'Общие удобства комплекса', 'สิ่งอำนวยความสะดวกส่วนกลาง', '公共设施'],
  ['body', 'Shared facilities at {project}. Hours and visitor rules are set by the complex.', 'Общие удобства комплекса {project}. Часы работы и правила посещения устанавливает комплекс.', 'สิ่งอำนวยความสะดวกส่วนกลางที่ {project} เวลาเปิดและกฎการใช้งานกำหนดโดยโครงการ', '{project} 的公共设施。开放时间和访客规定由公寓管理方制定。'],
  ['daily', 'Daily access', 'Ежедневный доступ', 'เวลาเข้าใช้ทุกวัน', '每日开放'],
  ['staffContact', 'Staff contact hours', 'Связь с сотрудниками', 'เวลาติดต่อเจ้าหน้าที่', '工作人员联系时间'],
  ['timezone', 'Time zone', 'Часовой пояс', 'เขตเวลา', '时区'],
  ['allDay', '24 hours', 'Круглосуточно', '24 ชั่วโมง', '24 小时'],
  ['days', 'day(s)', 'дн.', 'วัน', '天'],
  ['hours', 'hour(s)', 'ч.', 'ชั่วโมง', '小时'],
  ['minutes', 'minute(s)', 'мин.', 'นาที', '分钟'],
  ['lead', 'Book at least {amount} {unit} in advance', 'Бронировать минимум за {amount} {unit}', 'จองล่วงหน้าอย่างน้อย {amount} {unit}', '至少提前 {amount} {unit} 预约'],
  ['otherBooking', 'Advance booking required; booking method not specified', 'Требуется предварительная запись; способ записи не указан', 'ต้องจองล่วงหน้า ยังไม่ระบุวิธีจอง', '需要提前预约，预约方式尚未说明'],
  ['unknown', 'Not specified', 'Не указано', 'ยังไม่ระบุ', '未说明'],
] as const;
export const AMENITY_USAGE_LABELS = Object.fromEntries(rows.map(([key, en]) => [`amenity_usage.${key}`, en]));
export const AMENITY_USAGE_DRAFTS = Object.fromEntries(rows.map(([key, , ru, th, zh]) => [`amenity_usage.${key}`, { ru, th, zh }]));
export function amenityUsageLabels(labels: Record<string, string>) {
  return Object.fromEntries(rows.map(([key, en]) => [key, labels[`amenity_usage.${key}`] || en]));
}
