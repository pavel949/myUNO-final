/** Supplier listings surface copy. Drafts require language review before approval. */
export const PROPERTY_LISTINGS_KEYS = [
  { key: 'property.listings.title', en: 'My listings', ru: 'Мои объявления', th: 'ประกาศของฉัน', zh: '我的房源' },
  { key: 'property.listings.intro', en: 'Add a property as its owner or authorized management company. Drafts and applications stay private until myUNO verifies your authority and approves publication.', ru: 'Добавьте объект как собственник или уполномоченная управляющая компания. Черновики и заявки остаются закрытыми, пока myUNO не проверит ваши полномочия и не одобрит публикацию.', th: 'เพิ่มทรัพย์สินในฐานะเจ้าของหรือบริษัทจัดการที่ได้รับอนุญาต ฉบับร่างและใบสมัครจะเป็นส่วนตัวจนกว่า myUNO จะตรวจสอบสิทธิ์และอนุมัติการเผยแพร่', zh: '以业主或授权物业管理公司的身份添加房源。在 myUNO 核实您的权限并批准发布之前，草稿和申请不会公开。' },
  { key: 'property.listings.create', en: 'List a property', ru: 'Разместить объект', th: 'ลงประกาศที่พัก', zh: '发布房源' },
  { key: 'property.listings.management', en: 'Request myUNO management', ru: 'Передать в управление myUNO', th: 'ขอให้ myUNO จัดการ', zh: '申请 myUNO 托管' },
  { key: 'property.listings.applications', en: 'Your applications', ru: 'Ваши заявки', th: 'ใบสมัครของคุณ', zh: '您的申请' },
  { key: 'property.listings.empty', en: 'No applications yet.', ru: 'Заявок пока нет.', th: 'ยังไม่มีใบสมัคร', zh: '暂无申请。' },
  { key: 'property.listings.settings', en: 'Property settings', ru: 'Настройки объектов', th: 'การตั้งค่าทรัพย์สิน', zh: '房源设置' },
  { key: 'property.listings.settings_empty', en: 'Settings become available after verified ownership or company mandate and an active self-operated engagement. For myUNO-managed properties, use your owner dashboard.', ru: 'Настройки доступны после проверки права собственности или полномочий компании и активации самостоятельного управления. Для объектов под управлением myUNO используйте кабинет собственника.', th: 'การตั้งค่าจะพร้อมใช้งานหลังจากยืนยันความเป็นเจ้าของหรืออำนาจของบริษัทและเปิดใช้การจัดการด้วยตนเอง สำหรับทรัพย์สินที่ myUNO จัดการ ให้ใช้แดชบอร์ดเจ้าของ', zh: '验证所有权或公司授权并启用自主管理后，即可使用设置。对于 myUNO 托管的房源，请使用业主工作台。' },
  { key: 'property.listings.status.draft', en: 'Draft', ru: 'Черновик', th: 'ฉบับร่าง', zh: '草稿' },
  { key: 'property.listings.status.submitted', en: 'Submitted', ru: 'Отправлена', th: 'ส่งแล้ว', zh: '已提交' },
  { key: 'property.listings.status.converted', en: 'Property record created or linked', ru: 'Объект создан или найден', th: 'สร้างหรือเชื่อมโยงทรัพย์สินแล้ว', zh: '已创建或关联房源' },
  { key: 'property.listings.status.unknown', en: 'Status unavailable', ru: 'Статус недоступен', th: 'ไม่ทราบสถานะ', zh: '状态不可用' },
].map(entry => ({ ...entry, namespace: 'property', description: 'Supplier listings workspace copy', status: 'needs_review' as const }));

export const PROPERTY_LISTINGS_LOCALE_DRAFTS = Object.fromEntries(PROPERTY_LISTINGS_KEYS.map(({ key, en, ru, th, zh }) => [key, { en, ru, th, zh }]));
