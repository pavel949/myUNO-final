/** Registered draft copy for the bounded inquiry handoff; CMS translations win. */
export const INQUIRY_COPY = {
  'audience.management.how': { en: 'How it works', ru: 'Как это работает', th: 'ขั้นตอนการทำงาน', zh: '办理流程' },
  'audience.management.step1': { en: 'Send the location, property type and your priorities.', ru: 'Укажите расположение, тип объекта и ваши задачи.', th: 'แจ้งทำเล ประเภททรัพย์สิน และสิ่งที่คุณต้องการ', zh: '提供位置、房产类型和您的需求。' },
  'audience.management.step2': { en: 'The team reviews your brief and discusses the property and services with you.', ru: 'Команда рассмотрит заявку и обсудит с вами объект и услуги.', th: 'ทีมงานตรวจสอบข้อมูลและหารือเกี่ยวกับทรัพย์สินและบริการกับคุณ', zh: '团队会查看申请，并与您讨论房产及服务。' },
  'audience.management.step3': { en: 'Scope, responsibilities and commercial terms are agreed separately before management starts.', ru: 'Объём услуг, ответственность и коммерческие условия согласуются отдельно до начала управления.', th: 'ตกลงขอบเขตบริการ ความรับผิดชอบ และเงื่อนไขทางการค้าก่อนเริ่มบริหาร', zh: '管理开始前另行商定服务范围、责任和商业条款。' },
  'audience.choice.topic': { en: 'What are you looking for?', ru: 'Что вы ищете?', th: 'คุณกำลังมองหาอะไร?', zh: '您在寻找什么？' },
  'audience.choice.rent': { en: 'A holiday or long-term rental', ru: 'Жильё для отдыха или переезда', th: 'ที่พักวันหยุดหรือเช่าระยะยาว', zh: '度假或长期租房' },
  'audience.choice.buy': { en: 'A property to buy', ru: 'Недвижимость для покупки', th: 'อสังหาริมทรัพย์สำหรับซื้อ', zh: '购买房产' },
  'audience.choice.title': { en: 'Not sure where to start?', ru: 'Не знаете, с чего начать?', th: 'ไม่แน่ใจว่าจะเริ่มจากตรงไหน?', zh: '不知道从哪里开始？' },
  'audience.choice.body': { en: 'Tell us about your stay, move or home search. The team will review your request and reply using your contact details. Prices, availability and any professional advice need separate confirmation.', ru: 'Расскажите об отдыхе, переезде или поиске жилья. Команда рассмотрит запрос и ответит по указанным контактам. Цены, наличие и профессиональные консультации подтверждаются отдельно.', th: 'บอกเราเกี่ยวกับการเข้าพัก การย้ายบ้าน หรือการค้นหาบ้าน ทีมงานจะตรวจสอบคำขอและตอบผ่านช่องทางติดต่อที่คุณให้ไว้ ราคา ห้องว่าง และคำปรึกษาจากผู้เชี่ยวชาญต้องยืนยันแยกต่างหาก', zh: '告诉我们您的度假、搬迁或找房需求。团队会查看请求并通过您提供的联系方式回复。价格、房源和专业建议需另行确认。' },
  'audience.choice.cta': { en: 'Describe what you need', ru: 'Опишите задачу', th: 'บอกสิ่งที่คุณต้องการ', zh: '描述您的需求' },
  'audience.choice.manage': { en: 'Looking for property management?', ru: 'Хотите передать объект в управление?', th: 'ต้องการบริการจัดการทรัพย์สินหรือไม่?', zh: '需要房产管理服务？' },

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
