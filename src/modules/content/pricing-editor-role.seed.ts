/** Independently delegated pricing copy. All translations require editorial review. */
export const PRICING_EDITOR_ROLE_KEYS = [
  { key: 'admin.people.pricing_editor', en: 'Pricing editor', ru: 'Редактор тарифов', th: 'ผู้แก้ไขราคา', zh: '价格编辑员' },
  { key: 'admin.people.scope_pricing_unit', en: 'One exact unit: pricing only', ru: 'Один конкретный объект: только тарифы', th: 'ยูนิตที่ระบุหนึ่งยูนิต: เฉพาะราคา', zh: '一个指定房源：仅定价' },
  { key: 'admin.people.scope_pricing_project', en: 'All units in one project: pricing only', ru: 'Все объекты одного комплекса: только тарифы', th: 'ทุกยูนิตในโครงการเดียว: เฉพาะราคา', zh: '一个项目的所有房源：仅定价' },
  { key: 'admin.people.pricing_scope_note', en: 'Pricing access is assigned separately. Choose one exact unit or explicitly grant pricing for all units in one project. This role grants no availability, bookings, finance, private access, content or publishing permissions.', ru: 'Доступ к тарифам назначается отдельно. Выберите конкретный объект или явно разрешите изменение тарифов всех объектов одного комплекса. Эта роль не даёт доступа к доступности, бронированиям, финансам, приватным данным, контенту или публикации.', th: 'มอบหมายสิทธิ์ด้านราคาแยกต่างหาก เลือกยูนิตที่ระบุหรือมอบหมายราคาทุกยูนิตในโครงการเดียวอย่างชัดเจน บทบาทนี้ไม่ให้สิทธิ์ด้านห้องว่าง การจอง การเงิน ข้อมูลส่วนตัว เนื้อหา หรือการเผยแพร่', zh: '定价权限单独分配。选择指定房源，或明确授权一个项目的全部房源定价。此角色不授予可订状态、预订、财务、私密信息、内容或发布权限。' },
  { key: 'admin.people.pricing_workspace_link', en: 'Employee pricing workspace (share this link after assigning access)', ru: 'Кабинет тарифов сотрудника (передайте ссылку после назначения доступа)', th: 'พื้นที่ทำงานราคาของพนักงาน (แชร์ลิงก์หลังมอบหมายสิทธิ์)', zh: '员工定价工作区（分配权限后分享此链接）' },
  { key: 'property.workspaces.navigation', en: 'Assigned workspaces', ru: 'Назначенные кабинеты', th: 'พื้นที่ทำงานที่ได้รับมอบหมาย', zh: '已授权工作区' },
].map(row => ({ ...row, namespace: row.key.startsWith('admin.') ? 'admin' : 'property', description: 'Independent pricing role assignment and workspace navigation', status: 'needs_review' as const }));

export const PRICING_EDITOR_ROLE_LOCALE_DRAFTS = Object.fromEntries(
  PRICING_EDITOR_ROLE_KEYS.map(({ key, en, ru, th, zh }) => [key, { en, ru, th, zh }]),
);
