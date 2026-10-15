/** Contributor assignment copy. All locale drafts require editorial review. */
export const CONTENT_CONTRIBUTOR_ROLE_KEYS = [
  {
    key: 'admin.people.content_contributor',
    en: 'Content contributor',
    ru: 'Автор контента',
    th: 'ผู้จัดทำเนื้อหา',
    zh: '内容协作者',
  },
  {
    key: 'admin.people.scope_unit',
    en: 'One exact unit: draft content only',
    ru: 'Один конкретный объект: только черновики',
    th: 'ยูนิตที่ระบุหนึ่งยูนิต: เนื้อหาฉบับร่างเท่านั้น',
    zh: '一个指定房源：仅限内容草稿',
  },
  {
    key: 'admin.people.scope_shared_content',
    en: 'Shared complex content only (no unit access)',
    ru: 'Только общая информация о комплексе (без доступа к объектам)',
    th: 'เฉพาะเนื้อหาส่วนกลางของโครงการ (ไม่มีสิทธิ์เข้าถึงยูนิต)',
    zh: '仅限项目公共内容（无单套房源访问权限）',
  },
  {
    key: 'admin.people.content_scope_note',
    en: 'Contributors prepare content for review. A project assignment covers shared complex content only; each unit needs its own exact-unit assignment. This role grants no ownership, management, publishing, pricing or operations access.',
    ru: 'Автор готовит контент для проверки. Доступ к комплексу разрешает работу только с общей информацией о нём; доступ к каждому конкретному объекту назначается отдельно. Эта роль не даёт прав собственника, управляющего, публикации, изменения цен или ведения операций.',
    th: 'ผู้จัดทำเนื้อหาเตรียมข้อมูลเพื่อส่งตรวจสอบ สิทธิ์ระดับโครงการครอบคลุมเฉพาะเนื้อหาส่วนกลาง ต้องมอบหมายสิทธิ์แยกสำหรับแต่ละยูนิต บทบาทนี้ไม่ให้สิทธิ์ความเป็นเจ้าของ การจัดการ การเผยแพร่ การกำหนดราคา หรือการดำเนินงาน',
    zh: '协作者准备内容并提交审核。项目级授权仅涵盖项目公共内容；每套房源都需单独授权。此角色不授予所有权、管理、发布、定价或运营权限。',
  },
  {
    key: 'admin.people.unit',
    en: 'Exact unit',
    ru: 'Конкретный объект',
    th: 'ยูนิตที่ระบุ',
    zh: '指定房源',
  },
  {
    key: 'admin.people.unit_search',
    en: 'Find unit by name or exact ID',
    ru: 'Найти объект по названию или точному ID',
    th: 'ค้นหายูนิตด้วยชื่อหรือ ID ที่ตรงกัน',
    zh: '按名称或完整 ID 查找房源',
  },
  {
    key: 'admin.people.unit_choose',
    en: 'Choose one exact unit',
    ru: 'Выберите один конкретный объект',
    th: 'เลือกยูนิตที่ต้องการหนึ่งยูนิต',
    zh: '选择一个指定房源',
  },
  {
    key: 'admin.people.units_loading',
    en: 'Loading units…',
    ru: 'Загрузка объектов…',
    th: 'กำลังโหลดยูนิต…',
    zh: '正在加载房源…',
  },
  {
    key: 'admin.people.units_error',
    en: 'Units could not be loaded. Retry before granting access.',
    ru: 'Не удалось загрузить объекты. Повторите попытку перед назначением доступа.',
    th: 'โหลดยูนิตไม่สำเร็จ โปรดลองอีกครั้งก่อนมอบหมายสิทธิ์',
    zh: '无法加载房源。请重试后再授予访问权限。',
  },
  {
    key: 'admin.people.units_none',
    en: 'No matching units. Choose another project or change the search.',
    ru: 'Подходящих объектов нет. Выберите другой комплекс или измените запрос.',
    th: 'ไม่พบยูนิตที่ตรงกัน เลือกโครงการอื่นหรือเปลี่ยนคำค้นหา',
    zh: '没有匹配的房源。请选择其他项目或修改搜索条件。',
  },
  {
    key: 'admin.people.units_refine',
    en: 'Showing the first 50 units. Refine the search to find a specific unit.',
    ru: 'Показаны первые 50 объектов. Уточните запрос, чтобы найти нужный объект.',
    th: 'แสดง 50 ยูนิตแรก ปรับคำค้นหาเพื่อค้นหายูนิตที่ต้องการ',
    zh: '显示前 50 套房源。请细化搜索条件以找到指定房源。',
  },
  {
    key: 'admin.people.units_retry',
    en: 'Retry unit search',
    ru: 'Повторить поиск объектов',
    th: 'ค้นหายูนิตอีกครั้ง',
    zh: '重试房源搜索',
  },
  {
    key: 'admin.people.content_workspace_link',
    en: 'Employee content workspace (share this link after assigning access)',
    ru: 'Кабинет заполнения объектов (передайте ссылку после назначения доступа)',
    th: 'พื้นที่ทำงานเนื้อหาของพนักงาน (แชร์ลิงก์นี้หลังมอบหมายสิทธิ์)',
    zh: '员工内容工作区（分配权限后分享此链接）',
  },
].map((entry) => ({
  ...entry,
  namespace: 'admin',
  description: 'Content contributor role assignment copy',
  status: 'needs_review' as const,
}));

export const CONTENT_CONTRIBUTOR_ROLE_LOCALE_DRAFTS = Object.fromEntries(
  CONTENT_CONTRIBUTOR_ROLE_KEYS.map(({ key, en, ru, th, zh }) => [key, { en, ru, th, zh }]),
);
