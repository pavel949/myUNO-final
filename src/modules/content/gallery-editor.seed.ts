/** Registered locale drafts; CMS translations remain authoritative. */
export const GALLERY_COPY_KEYS = [
  {
    "key": "admin.gallery.copy_to_project",
    "namespace": "admin",
    "description": "Copy an existing unit photo to its parent complex gallery",
    "en": "Copy to complex gallery",
    "ru": "Копировать в галерею комплекса",
    "th": "คัดลอกไปยังแกลเลอรีโครงการ",
    "zh": "复制到项目图库",
    "status": "needs_review"
  },
  {
    "key": "admin.gallery.copy_done",
    "namespace": "admin",
    "description": "Copy an existing unit photo to its parent complex gallery",
    "en": "In complex gallery",
    "ru": "В галерее комплекса",
    "th": "อยู่ในแกลเลอรีโครงการแล้ว",
    "zh": "已在项目图库中",
    "status": "needs_review"
  },
  {
    "key": "admin.gallery.copy_saved",
    "namespace": "admin",
    "description": "Copy an existing unit photo to its parent complex gallery",
    "en": "Confirmed in the complex gallery. You can now remove this photo from the unit gallery; the original file will be kept.",
    "ru": "Фото подтверждено в галерее комплекса. Теперь его можно убрать из галереи юнита; исходный файл сохранится.",
    "th": "ยืนยันภาพในแกลเลอรีโครงการแล้ว คุณสามารถนำภาพนี้ออกจากแกลเลอรียูนิตได้ โดยไฟล์ต้นฉบับจะยังคงอยู่",
    "zh": "已确认照片在项目图库中。现在可以将其从单元图库移除，原始文件会保留。",
    "status": "needs_review"
  },
  {
    "key": "admin.gallery.copy_failed",
    "namespace": "admin",
    "description": "Copy an existing unit photo to its parent complex gallery",
    "en": "Could not confirm the photo in the complex gallery. Keep it in the unit gallery and retry.",
    "ru": "Не удалось подтвердить фото в галерее комплекса. Оставьте его в галерее юнита и повторите попытку.",
    "th": "ไม่สามารถยืนยันภาพในแกลเลอรีโครงการได้ โปรดเก็บภาพไว้ในแกลเลอรียูนิตและลองอีกครั้ง",
    "zh": "无法确认照片是否在项目图库中。请保留单元图库中的照片并重试。",
    "status": "needs_review"
  }
] as const;

export function galleryCopyLabelsForLocale(locale: string): Record<string, string> {
  const language = locale === "ru" || locale === "th" || locale === "zh" ? locale : "en";
  return Object.fromEntries(GALLERY_COPY_KEYS.map(row => [row.key, row[language]]));
}
export const GALLERY_COPY_LOCALE_DRAFTS = Object.fromEntries(GALLERY_COPY_KEYS.map(row => [row.key, { en: row.en, ru: row.ru, th: row.th, zh: row.zh }]));

/** Admin gallery editor copy. Locale drafts may be refined in Content Admin. */
export const GALLERY_EDITOR_KEYS = [
  ...GALLERY_COPY_KEYS,
  { key: 'admin.gallery.manage', namespace: 'admin', description: 'Gallery entry point', en: 'Manage photos and galleries', ru: 'Управление фотографиями и галереями', th: 'จัดการภาพและแกลเลอรี', status: 'needs_review' as const },
  { key: 'admin.gallery.title', namespace: 'admin', description: 'Gallery onboarding/editor', en: "Which gallery are you editing?", ru: "Какую галерею вы редактируете?", th: "คุณกำลังแก้ไขแกลเลอรีใด", status: 'needs_review' as const },
  { key: 'admin.gallery.scope_hint', namespace: 'admin', description: 'Gallery onboarding/editor', en: "Project photos show the whole property. Category photos show a room or villa type. Unit photos show the exact villa or condo.", ru: "Фотографии проекта показывают весь комплекс, категории — тип номера или виллы, а юнита — конкретную виллу или кондоминиум.", th: "ภาพโครงการแสดงทั้งพื้นที่ ภาพหมวดหมู่แสดงประเภทห้องหรือวิลล่า และภาพยูนิตแสดงยูนิตจริง", status: 'needs_review' as const },
  { key: 'admin.gallery.level', namespace: 'admin', description: 'Gallery onboarding/editor', en: "Level", ru: "Уровень", th: "ระดับ", status: 'needs_review' as const },
  { key: 'admin.gallery.project', namespace: 'admin', description: 'Gallery onboarding/editor', en: "1. Property / hotel / resort", ru: "1. Проект / отель / резорт", th: "1. โครงการ / โรงแรม / รีสอร์ต", status: 'needs_review' as const },
  { key: 'admin.gallery.category', namespace: 'admin', description: 'Gallery onboarding/editor', en: "2. Room / villa category", ru: "2. Категория номера / виллы", th: "2. ประเภทห้อง / วิลล่า", status: 'needs_review' as const },
  { key: 'admin.gallery.unit', namespace: 'admin', description: 'Gallery onboarding/editor', en: "3. Individual villa / condo", ru: "3. Конкретная вилла / кондоминиум", th: "3. วิลล่า / คอนโดรายยูนิต", status: 'needs_review' as const },
  { key: 'admin.gallery.object', namespace: 'admin', description: 'Gallery onboarding/editor', en: "Object", ru: "Объект", th: "ยูนิต", status: 'needs_review' as const },
  { key: 'admin.gallery.photos', namespace: 'admin', description: 'Gallery onboarding/editor', en: "photos", ru: "фотографий", th: "รูปภาพ", status: 'needs_review' as const },
  { key: 'admin.gallery.hint', namespace: 'admin', description: 'Gallery onboarding/editor', en: "Upload photos, set a cover, adjust order, or remove a photo from this gallery.", ru: "Загрузите фото, назначьте обложку, измените порядок или уберите фото из этой галереи.", th: "อัปโหลดภาพ เลือกภาพปก จัดลำดับ หรือนำภาพออกจากแกลเลอรีนี้", status: 'needs_review' as const },
  { key: 'admin.gallery.add', namespace: 'admin', description: 'Gallery onboarding/editor', en: "Add photos", ru: "Добавить фотографии", th: "เพิ่มรูปภาพ", status: 'needs_review' as const },
  { key: 'admin.gallery.saving', namespace: 'admin', description: 'Gallery onboarding/editor', en: "Saving…", ru: "Сохранение…", th: "กำลังบันทึก…", status: 'needs_review' as const },
  { key: 'admin.gallery.loading', namespace: 'admin', description: 'Gallery onboarding/editor', en: "Loading gallery…", ru: "Загрузка галереи…", th: "กำลังโหลดแกลเลอรี…", status: 'needs_review' as const },
  { key: 'admin.gallery.empty', namespace: 'admin', description: 'Gallery onboarding/editor', en: "No photos yet. Add images for this level; photos from another gallery are not automatically assigned to a specific unit.", ru: "Фотографий пока нет. Добавьте изображения для этого уровня: фотографии другой галереи не привязываются автоматически к конкретному юниту.", th: "ยังไม่มีภาพ เพิ่มภาพสำหรับระดับนี้ โดยภาพจากแกลเลอรีอื่นจะไม่ถูกผูกกับยูนิตนี้โดยอัตโนมัติ", status: 'needs_review' as const },
  { key: 'admin.gallery.cover', namespace: 'admin', description: 'Gallery onboarding/editor', en: "Cover photo", ru: "Обложка", th: "ภาพปก", status: 'needs_review' as const },
  { key: 'admin.gallery.set_cover', namespace: 'admin', description: 'Gallery onboarding/editor', en: "Set cover", ru: "Сделать обложкой", th: "ตั้งเป็นภาพปก", status: 'needs_review' as const },
  { key: 'admin.gallery.remove', namespace: 'admin', description: 'Gallery onboarding/editor', en: "Remove from gallery", ru: "Убрать из галереи", th: "นำออกจากแกลเลอรี", status: 'needs_review' as const },
  { key: 'admin.gallery.safe_remove', namespace: 'admin', description: 'Gallery onboarding/editor', en: "Removing a photo only detaches it from this gallery; the shared file and other galleries are unchanged.", ru: "Удаление фотографии из галереи не удаляет общий файл и не меняет другие галереи.", th: "การนำภาพออกไม่ลบไฟล์ต้นฉบับและไม่กระทบแกลเลอรีอื่น", status: 'needs_review' as const },
  { key: 'admin.gallery.saved', namespace: 'admin', description: 'Gallery onboarding/editor', en: "Gallery saved.", ru: "Галерея сохранена.", th: "บันทึกแกลเลอรีแล้ว", status: 'needs_review' as const },
];
