/** Operational access copy remains subject to normal locale review. */
const rows = [
  ['title', 'Workspace access', 'Доступ к рабочим пространствам', 'สิทธิ์เข้าถึงพื้นที่ทำงาน'],
  ['intro', 'Choose an existing organization, exact homes and the people who may work there. This does not create ownership or a management mandate.', 'Выберите существующую организацию, конкретные объекты и сотрудников. Это не создаёт право собственности или договор управления.', 'เลือกองค์กร บ้าน และผู้ปฏิบัติงานที่มีอยู่ การตั้งค่านี้ไม่สร้างกรรมสิทธิ์หรือสัญญาบริหาร'],
  ['people', 'People & project roles', 'Люди и роли в проектах', 'บุคคลและบทบาทโครงการ'],
  ['create', 'Create workspace', 'Создать рабочее пространство', 'สร้างพื้นที่ทำงาน'],
  ['organization', 'Existing operating organization', 'Существующая управляющая организация', 'องค์กรผู้ดำเนินงานที่มีอยู่'],
  ['choose', 'Choose…', 'Выберите…', 'เลือก…'],
  ['name', 'Workspace name', 'Название пространства', 'ชื่อพื้นที่ทำงาน'],
  ['key', 'Workspace key', 'Ключ пространства', 'รหัสพื้นที่ทำงาน'],
  ['units', 'Exact homes in this workspace', 'Конкретные объекты пространства', 'บ้านในพื้นที่ทำงานนี้'],
  ['no_units', 'No eligible homes. Confirm the organization’s current verified operating relationship first.', 'Нет доступных объектов. Сначала подтвердите действующие полномочия организации на управление.', 'ไม่มีบ้านที่มีสิทธิ์ โปรดยืนยันความสัมพันธ์การดำเนินงานขององค์กรก่อน'],
  ['unavailable', 'Unavailable for new grants; existing access may be removed', 'Новые права недоступны; существующие можно снять', 'ยังไม่เปิดให้สิทธิ์ใหม่ สามารถถอนสิทธิ์เดิมได้'],
  ['daily_scope', 'This setup enables manual tasks, housekeeping and maintenance. Reservations, finance and recurring automation need separate readiness checks.', 'Эта настройка включает ручные задачи, уборку и обслуживание. Бронирования, финансы и регулярная автоматизация требуют отдельной проверки.', 'การตั้งค่านี้ใช้กับงานที่สร้างเอง แม่บ้าน และซ่อมบำรุง การจอง การเงิน และงานอัตโนมัติต้องตรวจสอบเพิ่มเติม'],
  ['scope_note', 'New selections require a verified operating relationship. Existing attachments remain visible so they can be removed. Nothing is selected automatically.', 'Показаны только объекты с подтверждёнными действующими полномочиями управления. Автоматического выбора нет.', 'แสดงเฉพาะบ้านที่มีความสัมพันธ์การดำเนินงานที่ยืนยันแล้ว ไม่มีการเลือกอัตโนมัติ'],
  ['select_space', 'Existing workspace', 'Существующее пространство', 'พื้นที่ทำงานที่มีอยู่'],
  ['empty', 'No active workspaces. Create one using an existing organization and its verified homes.', 'Активных пространств нет. Создайте пространство для существующей организации и её подтверждённых объектов.', 'ยังไม่มีพื้นที่ทำงานที่ใช้งานอยู่ สร้างจากองค์กรและบ้านที่ยืนยันแล้ว'],
  ['save_scope', 'Save selected homes', 'Сохранить выбранные объекты', 'บันทึกบ้านที่เลือก'],
  ['delegation', 'Member access', 'Доступ сотрудников', 'สิทธิ์สมาชิก'],
  ['prerequisite', 'First grant a project staff role and the required departments in People & Roles, or verify the person’s management-company mandate. Workspace access is only their intersection; it never creates broader project rights.', 'Сначала назначьте роль сотрудника и нужные отделы в разделе «Люди и роли» либо проверьте полномочия управляющей компании. Доступ ограничен пересечением этих прав и пространства.', 'กำหนดบทบาทพนักงานและแผนกที่จำเป็น หรือยืนยันอำนาจของบริษัทบริหารก่อน สิทธิ์พื้นที่ทำงานจำกัดอยู่ภายในสิทธิ์เดิมเท่านั้น'],
  ['search', 'Find existing person', 'Найти существующего пользователя', 'ค้นหาบุคคลที่มีอยู่'],
  ['no_people', 'No matching active people.', 'Активные пользователи не найдены.', 'ไม่พบบุคคลที่ใช้งานอยู่'],
  ['capabilities', 'Explicit capabilities', 'Разрешённые действия', 'สิทธิ์ที่ระบุ'],
  ['save_member', 'Save member access', 'Сохранить доступ', 'บันทึกสิทธิ์สมาชิก'],
  ['deactivate', 'Deactivate workspace access', 'Отключить доступ к пространству', 'ปิดสิทธิ์พื้นที่ทำงาน'],
  ['inactive', 'Inactive', 'Неактивен', 'ไม่ใช้งาน'],
  ['active', 'Active', 'Активен', 'ใช้งาน'],
  ['saving', 'Saving…', 'Сохраняем…', 'กำลังบันทึก…'],
  ['saved', 'Saved. Review the updated scope below.', 'Сохранено. Проверьте обновлённые права ниже.', 'บันทึกแล้ว โปรดตรวจสอบขอบเขตที่อัปเดตด้านล่าง'],
  ['failed', 'Could not save. Your choices are kept; review the error and retry.', 'Не удалось сохранить. Выбор сохранён в форме: проверьте ошибку и повторите.', 'บันทึกไม่สำเร็จ ตัวเลือกยังอยู่ โปรดตรวจสอบข้อผิดพลาดแล้วลองอีกครั้ง'],
  ['loading', 'Loading…', 'Загрузка…', 'กำลังโหลด…'],
  ['create_unit', 'Create property drafts', 'Создавать черновики объектов', 'สร้างร่างที่พัก', '创建房源草稿'],
  ['create_complex', 'Create complex drafts', 'Создавать черновики комплексов', 'สร้างร่างโครงการ', '创建小区草稿'],
  ['creation_note', 'Creation rights are independent. They allow descriptive drafts and administrator review within this verified workspace, without operational, pricing, ownership or publication rights. Only the founder manages these grants; managers cannot delegate them.', 'Права создания независимы. Они разрешают подготовку описательных черновиков для проверки администратором в пределах подтверждённого пространства, без прав на операции, цены, собственность или публикацию. Эти права назначает только основатель; менеджеры не могут их делегировать.', 'สิทธิ์สร้างแต่ละประเภทแยกจากกัน อนุญาตให้เตรียมร่างข้อมูลเพื่อให้ผู้ดูแลระบบตรวจสอบภายในพื้นที่ทำงานที่ยืนยันแล้ว ไม่ให้สิทธิ์ดำเนินงาน ตั้งราคา กรรมสิทธิ์ หรือเผยแพร่ ผู้ก่อตั้งเท่านั้นที่จัดการสิทธิ์เหล่านี้ ผู้จัดการไม่สามารถมอบหมายต่อได้', '两项创建权限相互独立，仅允许在已核实的工作区内准备描述性草稿并提交管理员审核，不授予运营、定价、所有权或发布权限。这些权限仅由创始人管理，经理不能转授。'],
  ['selected', 'Selected homes', 'Выбрано объектов', 'บ้านที่เลือก'],
] as const;
export const OPERATING_GOVERNANCE_LABELS: Record<string, string> = Object.fromEntries(rows.map(([key, en]) => ['admin.access.' + key, en]));
export const OPERATING_GOVERNANCE_KEYS = rows.map(([key, en, ru, th, zh]) => ({
  key: 'admin.access.' + key, namespace: 'admin', description: 'Operating workspace access: ' + key,
  en, ru, th, ...(zh ? { zh } : {}), status: 'needs_review' as const,
}));

export const OPERATING_GOVERNANCE_DRAFTS = Object.fromEntries(rows.map(([key, en, ru, th, zh]) => ['admin.access.' + key, { en, ru, th, ...(zh ? { zh } : {}) }]));
