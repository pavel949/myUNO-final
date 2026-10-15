/** Reviewable guest recovery copy; no automatic CMS approval or writes. */
export const GUEST_AUTH_SUPPORT_KEYS = [
  { key: 'messages.inbox.choose_trip', namespace: 'messages', en: 'Open your trips', ru: 'Открыть мои поездки', th: 'เปิดการเดินทางของคุณ', zh: '打开您的行程' },
  { key: 'tickets.new.choose_trip', namespace: 'tickets', en: 'Choose your trip', ru: 'Выбрать поездку', th: 'เลือกการเดินทาง', zh: '选择行程' },
  { key: 'tickets.list.filter_empty', namespace: 'tickets', en: 'No requests with this status. Choose All to see your requests.', ru: 'Нет обращений с этим статусом. Выберите «Все», чтобы увидеть остальные.', th: 'ไม่มีคำขอสถานะนี้ เลือกทั้งหมดเพื่อดูคำขอของคุณ', zh: '没有此状态的请求。选择全部以查看您的请求。' },
  { key: 'messages.thread.retry', namespace: 'messages', en: 'Try again', ru: 'Повторить', th: 'ลองอีกครั้ง', zh: '重试' },
  { key: 'messages.thread.load_error', namespace: 'messages', en: 'Could not refresh this conversation. Your message draft is kept.', ru: 'Не удалось обновить переписку. Черновик сообщения сохранён.', th: 'ไม่สามารถอัปเดตการสนทนาได้ ข้อความร่างของคุณยังอยู่', zh: '无法刷新此对话。您的消息草稿已保留。' },
  { key: 'messages.thread.empty', namespace: 'messages', en: 'Start the conversation by sending a message below.', ru: 'Начните переписку: отправьте сообщение ниже.', th: 'เริ่มการสนทนาโดยส่งข้อความด้านล่าง', zh: '发送下方消息以开始对话。' },
].map(item => ({ ...item, description: 'Guest authentication and support recovery UX', status: 'needs_review' as const }));
