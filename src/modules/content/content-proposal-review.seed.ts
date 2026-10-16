/** Registered reviewer copy; new facility review labels have EN/RU/TH/ZH drafts. */
export const CONTENT_PROPOSAL_REVIEW_KEYS = [
  {
    key: 'property.content.review.title',
    "en": "Review property content",
    "ru": "Проверка карточек объектов"
  },
  {
    key: 'property.content.review.intro',
    "en": "Review assigned employees’ proposed facts, descriptions, galleries and complex facilities before applying them to the property.",
    "ru": "Проверьте характеристики, описания, галереи и инфраструктуру комплекса, которые подготовили назначенные сотрудники, прежде чем применить их к объекту.",
    "th": "ตรวจสอบข้อมูลพื้นฐาน คำอธิบาย แกลเลอรีรูปภาพ และสิ่งอำนวยความสะดวกส่วนกลางของโครงการที่พนักงานผู้ได้รับมอบหมายเสนอ ก่อนนำไปใช้กับที่พัก",
    "zh": "在应用到房源前，请审核获指派员工提交的房源信息、描述、相册及项目配套设施修改建议。"
  },
  {
    key: 'property.content.review.filter',
    "en": "Proposal status",
    "ru": "Статус правок"
  },
  {
    key: 'property.content.review.status.submitted',
    "en": "Awaiting review",
    "ru": "На проверке"
  },
  {
    key: 'property.content.review.status.returned',
    "en": "Returned for changes",
    "ru": "Возвращено на доработку"
  },
  {
    key: 'property.content.review.status.draft',
    "en": "Draft",
    "ru": "Черновик"
  },
  {
    key: 'property.content.review.status.approved',
    "en": "Applied",
    "ru": "Применено"
  },
  {
    key: 'property.content.review.status.all',
    "en": "All proposals",
    "ru": "Все правки"
  },
  {
    key: 'property.content.review.scope.unit',
    "en": "One home",
    "ru": "Одна квартира"
  },
  {
    key: 'property.content.review.scope.project',
    "en": "Shared complex content",
    "ru": "Общие данные комплекса"
  },
  {
    key: 'property.content.review.reload',
    "en": "Refresh queue",
    "ru": "Обновить очередь"
  },
  {
    key: 'property.content.review.loading',
    "en": "Loading proposals…",
    "ru": "Загружаем правки…"
  },
  {
    key: 'property.content.review.error',
    "en": "Unable to load or save. Refresh and try again.",
    "ru": "Не удалось загрузить или сохранить. Обновите страницу и повторите попытку."
  },
  {
    key: 'property.content.review.forbidden',
    "en": "Your administrator access is no longer available. Sign in again or contact the responsible administrator.",
    "ru": "Доступ администратора недоступен. Войдите снова или обратитесь к ответственному администратору."
  },
  {
    key: 'property.content.review.conflict',
    "en": "The proposal or property changed. Nothing was applied. Refresh the queue; return the proposal to its author to refresh the property baseline if needed.",
    "ru": "Правки или объект изменились. Ничего не применено. Обновите очередь; при необходимости верните правки автору, чтобы он обновил исходные данные объекта."
  },
  {
    key: 'property.content.review.approved',
    "en": "The reviewed content was applied. Ownership, prices and publication status are unchanged.",
    "ru": "Проверенные данные применены. Собственник, цены и статус публикации не изменены."
  },
  {
    key: 'property.content.review.returned',
    "en": "Returned to the author with your note.",
    "ru": "Правки возвращены автору с вашим комментарием."
  },
  {
    key: 'property.content.review.empty',
    "en": "Not specified",
    "ru": "Не указано"
  },
  {
    key: 'property.content.review.photo',
    "en": "Photo {number}",
    "ru": "Фото {number}"
  },
  {
    key: 'property.content.review.image_unavailable',
    "en": "Image unavailable",
    "ru": "Изображение недоступно"
  },
  {
    key: 'property.content.review.cover',
    "en": "Cover",
    "ru": "Обложка"
  },
  {
    key: 'property.content.review.none',
    "en": "No proposals with this status.",
    "ru": "Правок с таким статусом пока нет."
  },
  {
    key: 'property.content.review.author',
    "en": "Submitted by",
    "ru": "Автор"
  },
  {
    key: 'property.content.review.baseline_hint',
    "en": "Compare the saved starting version with the proposed content. A concurrent property edit blocks approval.",
    "ru": "Сравните сохранённую исходную версию с предложенными правками. Если объект изменён параллельно, применение будет заблокировано."
  },
  {
    key: 'property.content.review.facts',
    "en": "Property facts",
    "ru": "Характеристики объекта"
  },
  {
    key: 'property.content.review.changed',
    "en": "Changed",
    "ru": "Изменено"
  },
  {
    key: 'property.content.review.before',
    "en": "Starting version",
    "ru": "Исходная версия"
  },
  {
    key: 'property.content.review.after',
    "en": "Proposed version",
    "ru": "Предложенная версия"
  },
  {
    key: 'property.content.review.description',
    "en": "Description",
    "ru": "Описание"
  },
  {
    key: 'property.content.review.description_unchanged',
    "en": "No description change; existing languages are preserved.",
    "ru": "Описание не меняется; существующие переводы сохраняются."
  },
  {
    key: 'property.content.review.gallery',
    "en": "Gallery and cover order",
    "ru": "Галерея, порядок и обложка"
  },
  {
    key: 'property.content.review.amenities',
    "en": "Complex facilities",
    "ru": "Инфраструктура комплекса",
    "th": "สิ่งอำนวยความสะดวกส่วนกลางของโครงการ",
    "zh": "项目配套设施"
  },
  {
    key: 'property.content.review.amenities_unchanged',
    "en": "No facility changes proposed; all existing facilities are preserved.",
    "ru": "Изменения инфраструктуры не предложены; все существующие объекты сохраняются.",
    "th": "ไม่มีการเสนอแก้ไขสิ่งอำนวยความสะดวก โดยคงสิ่งอำนวยความสะดวกเดิมทั้งหมดไว้",
    "zh": "未提出设施变更；所有现有设施均予保留。"
  },
  {
    key: 'property.content.review.amenities_hint',
    "en": "Only the facilities listed below are updated or added. Nothing is removed. New facilities stay unpublished and have no booking offer. Publishing requires a separate action by an authorized user. Approval does not enable booking or change prices. Changed text in the selected language also updates the shared fallback; empty text may still display another existing translation.",
    "ru": "Будут изменены или добавлены только перечисленные ниже объекты инфраструктуры. Ничего не удаляется. Новые объекты остаются неопубликованными и без предложения для бронирования. Публикация требует отдельного действия сотрудника с соответствующими правами. Одобрение не включает бронирование и не меняет цены. Изменённый текст выбранного языка также обновляет общий текст для подстановки при отсутствии перевода; вместо пустого текста может отображаться другой существующий перевод.",
    "th": "จะปรับปรุงหรือเพิ่มเฉพาะสิ่งอำนวยความสะดวกที่ระบุด้านล่างเท่านั้น โดยไม่มีการลบรายการใด สิ่งอำนวยความสะดวกใหม่จะยังไม่เผยแพร่และยังไม่มีข้อเสนอให้จอง การเผยแพร่ต้องดำเนินการแยกต่างหากโดยผู้ใช้ที่มีสิทธิ์ การอนุมัติไม่เปิดให้จองและไม่เปลี่ยนราคา การแก้ไขข้อความในภาษาที่เลือกจะอัปเดตข้อความสำรองที่ใช้ร่วมกันด้วย หากข้อความว่าง ระบบอาจยังแสดงคำแปลภาษาอื่นที่มีอยู่",
    "zh": "仅更新或新增下方列出的设施，不会删除任何设施。新设施仍不公开，且不提供可预订的项目。发布须由获授权用户另行操作。批准不会开放预订或更改价格。修改所选语言的文本时，也会更新缺少翻译时使用的通用文本；空文本仍可能显示其他已有译文。"
  },
  {
    key: 'property.content.review.review_note',
    "en": "Reviewer note",
    "ru": "Комментарий проверяющего"
  },
  {
    key: 'property.content.review.apply_hint',
    "en": "Approval changes the canonical property card. If that card is already public, visitors can see the new content immediately. This action does not change ownership, prices or publication status.",
    "ru": "Одобрение меняет основную карточку объекта. Если карточка уже опубликована, посетители сразу увидят новые данные. Собственник, цены и статус публикации не меняются."
  },
  {
    key: 'property.content.review.confirm',
    "en": "I checked the facts, description, each photo and any proposed complex facilities for this exact property and approve applying these changes.",
    "ru": "Я проверил характеристики, описание, каждое фото и предложенные изменения инфраструктуры комплекса именно этого объекта и согласен применить эти изменения.",
    "th": "ฉันได้ตรวจสอบข้อมูลพื้นฐาน คำอธิบาย รูปภาพทุกรูป และข้อเสนอแก้ไขสิ่งอำนวยความสะดวกส่วนกลางของโครงการสำหรับที่พักนี้แล้ว และอนุมัติให้นำการแก้ไขเหล่านี้ไปใช้",
    "zh": "我已核查此房源的信息、描述、每张照片及所有拟议的项目配套设施变更，并批准应用这些修改。"
  },
  {
    key: 'property.content.review.note',
    "en": "Review note (required when returning)",
    "ru": "Комментарий (обязателен при возврате)"
  },
  {
    key: 'property.content.review.approve',
    "en": "Approve and apply content",
    "ru": "Одобрить и применить"
  },
  {
    key: 'property.content.review.return',
    "en": "Return for changes",
    "ru": "Вернуть на доработку"
  }
].map(entry => ({ ...entry, namespace: 'property', description: 'Scoped property content review copy', status: 'needs_review' as const }));

export const CONTENT_PROPOSAL_REVIEW_DRAFTS = Object.fromEntries(CONTENT_PROPOSAL_REVIEW_KEYS.map(({ key, en, ru, th, zh }) => [key, { en, ru, ...(th ? { th } : {}), ...(zh ? { zh } : {}) }]));
