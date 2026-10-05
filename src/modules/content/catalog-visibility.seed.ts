/**
 * Public catalog copy for inventory that is visible but not yet bookable
 * (imported managed homes shown as inquiry-only). Drafts: copy review required.
 */
export const CATALOG_VISIBILITY_KEYS = [
  { key: 'project_category.inquiry_unit', namespace: 'project_category', description: 'Inquiry-only home link', en: 'Ask about this home →', ru: 'Узнать об этом доме →', th: 'สอบถามเกี่ยวกับบ้านหลังนี้ →', status: 'needs_review' as const },
  { key: 'project_category.pending', namespace: 'project_category', description: 'Home without final photos or booking terms', en: 'Exact photos or online booking terms are still being completed.', ru: 'Точные фотографии и условия онлайн-бронирования ещё уточняются.', th: 'กำลังจัดทำภาพถ่ายจริงหรือเงื่อนไขการจองออนไลน์', status: 'needs_review' as const },
  { key: 'project_page.units.details_pending', namespace: 'project_page', description: 'Home details pending note', en: 'Details and booking terms are being completed. You can already ask about this home.', ru: 'Описание и условия бронирования уточняются. Вы уже можете задать вопрос об этом доме.', th: 'กำลังจัดทำรายละเอียดและเงื่อนไขการจอง คุณสามารถสอบถามเกี่ยวกับบ้านหลังนี้ได้แล้ว', status: 'needs_review' as const },
  { key: 'project_page.units.inquiry', namespace: 'project_page', description: 'Inquiry-only home link', en: 'Ask about this home →', ru: 'Узнать об этом доме →', th: 'สอบถามเกี่ยวกับบ้านหลังนี้ →', status: 'needs_review' as const },
  { key: 'projects.hub.no_photo', namespace: 'projects', description: 'Placeholder image caption', en: 'Illustrative image', ru: 'Иллюстративное изображение', th: 'ภาพประกอบ', status: 'needs_review' as const },
  { key: 'projects.hub.responsibility_project', namespace: 'projects', description: 'Who operates the project', en: 'Operations managed by {org}', ru: 'Управление: {org}', th: 'บริหารจัดการโดย {org}', status: 'needs_review' as const },
  { key: 'projects.hub.responsibility_selected', namespace: 'projects', description: 'Who manages selected homes', en: 'Selected homes managed by {org}', ru: 'Отдельные дома под управлением {org}', th: 'บ้านบางหลังบริหารจัดการโดย {org}', status: 'needs_review' as const },
] as const;
