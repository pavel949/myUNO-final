/** Registered draft copy for the bounded inquiry handoff; CMS translations win. */
export const INQUIRY_COPY = {
  'audience.lead.retry': { en: 'We could not confirm receipt. Your details are still here. Try sending again; the same request will not be duplicated.', ru: 'Не удалось подтвердить получение. Ваши данные сохранены в форме. Отправьте ещё раз: повторная отправка того же запроса не создаст дубликат.', th: 'ยังยืนยันการรับคำขอไม่ได้ ข้อมูลยังอยู่ในแบบฟอร์ม โปรดลองส่งอีกครั้ง ระบบจะไม่สร้างคำขอเดิมซ้ำ', zh: '暂时无法确认收件。表单内容仍在，请重试；相同请求不会重复创建。' },
  'audience.lead.rate_limited': { en: 'Too many attempts. Please wait before sending this form again.', ru: 'Слишком много попыток. Подождите, прежде чем отправить форму ещё раз.', th: 'มีการส่งหลายครั้งเกินไป โปรดรอก่อนส่งแบบฟอร์มอีกครั้ง', zh: '尝试次数过多。请稍后重试。' },

  'audience.lead.view_conversation': { en: 'View conversation', ru: 'Открыть переписку', th: 'ดูการสนทนา', zh: '查看对话' },
  'audience.lead.contact_followup': { en: 'We will use the contact details you provided to reply. This request is not linked to an online conversation for you.', ru: 'Мы ответим по указанным вами контактам. Этот запрос не связан с перепиской в вашем аккаунте.', th: 'เราจะตอบกลับผ่านช่องทางติดต่อที่คุณให้ไว้ คำขอนี้ไม่ได้เชื่อมกับการสนทนาออนไลน์ของคุณ', zh: '我们会通过您提供的联系方式回复。此请求未关联到您的在线对话。' },
  'audience.lead.selected_home': { en: 'Your enquiry', ru: 'Ваш запрос', th: 'คำถามของคุณ', zh: '您的咨询' },
} as const;
export function inquiryLabels(locale: string = 'en') {
  const selected = locale === 'ru' || locale === 'th' || locale === 'zh' ? locale : 'en';
  return Object.fromEntries(Object.entries(INQUIRY_COPY).map(([key, value]) => [key, value[selected]])) as Record<keyof typeof INQUIRY_COPY, string>;
}
export const INQUIRY_CONTENT_KEYS = Object.entries(INQUIRY_COPY).map(([key, translations]) => ({
  key, namespace: 'audience', description: 'Public inquiry conversation handoff', ...translations, status: 'needs_review' as const,
}));
