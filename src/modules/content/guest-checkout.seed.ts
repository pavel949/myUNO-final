/** Locale drafts for recovery copy; reviewed CMS translations remain authoritative. */
const GUEST_CHECKOUT_DRAFTS = {
  'payments.checkout.order_reconciliation_body': {
    en: 'We received your payment, but could not confirm this service order. Open the order and contact support. Do not pay again. A refund has not yet been confirmed.',
    ru: 'Оплата получена, но заказ услуги не удалось подтвердить. Откройте заказ и обратитесь в поддержку. Не платите повторно. Возврат ещё не подтверждён.',
    th: 'ได้รับการชำระเงินแล้ว แต่ไม่สามารถยืนยันคำสั่งซื้อบริการได้ เปิดคำสั่งซื้อและติดต่อฝ่ายช่วยเหลือ อย่าชำระเงินซ้ำ ยังไม่ได้ยืนยันการคืนเงิน',
  },
  'payments.checkout.order_refunded_body': {
    en: 'This payment has been refunded. Open your order for its current status.',
    ru: 'Оплата возвращена. Откройте заказ, чтобы проверить его текущий статус.',
    th: 'คืนเงินสำหรับการชำระนี้แล้ว เปิดคำสั่งซื้อเพื่อดูสถานะปัจจุบัน',
  },
  'booking.review.loading_quote': {
    en: 'Checking availability and the total for your stay…',
    ru: 'Проверяем доступность и стоимость проживания…',
    th: 'กำลังตรวจสอบห้องว่างและราคารวมสำหรับการเข้าพัก…',
  },
  'booking.review.retry_quote': {
    en: 'Check availability again',
    ru: 'Проверить доступность ещё раз',
    th: 'ตรวจสอบห้องว่างอีกครั้ง',
  },
  'payments.checkout.receipt_body': {
    en: 'Your payment was received. Open your trip for the booking status and next steps.',
    ru: 'Оплата получена. Откройте поездку, чтобы проверить статус бронирования и дальнейшие шаги.',
    th: 'ได้รับการชำระเงินแล้ว เปิดทริปเพื่อดูสถานะการจองและขั้นตอนถัดไป',
  },
  'payments.checkout.order_success_body': {
    en: 'Your payment was received. Open your order for its status and next steps.',
    ru: 'Оплата получена. Откройте заказ, чтобы проверить его статус и дальнейшие шаги.',
    th: 'ได้รับการชำระเงินแล้ว เปิดคำสั่งซื้อเพื่อดูสถานะและขั้นตอนถัดไป',
  },
  'payments.checkout.back_to_order': {
    en: 'View your order', ru: 'Открыть заказ', th: 'ดูคำสั่งซื้อ',
  },
};

export const REVIEW_CHECKOUT_DRAFTS = {
  'booking.review.loading_quote': GUEST_CHECKOUT_DRAFTS['booking.review.loading_quote'],
  'booking.review.retry_quote': GUEST_CHECKOUT_DRAFTS['booking.review.retry_quote'],
};
export const PAYMENT_CHECKOUT_DRAFTS = {
  'payments.checkout.order_reconciliation_body': GUEST_CHECKOUT_DRAFTS['payments.checkout.order_reconciliation_body'],
  'payments.checkout.order_refunded_body': GUEST_CHECKOUT_DRAFTS['payments.checkout.order_refunded_body'],
  'payments.checkout.receipt_body': GUEST_CHECKOUT_DRAFTS['payments.checkout.receipt_body'],
  'payments.checkout.order_success_body': GUEST_CHECKOUT_DRAFTS['payments.checkout.order_success_body'],
  'payments.checkout.back_to_order': GUEST_CHECKOUT_DRAFTS['payments.checkout.back_to_order'],
};
export const GUEST_CHECKOUT_KEYS = [
  { key: 'payments.checkout.order_reconciliation_body', namespace: 'payments', description: 'Service payment reconciliation recovery', ...GUEST_CHECKOUT_DRAFTS['payments.checkout.order_reconciliation_body'], status: 'needs_review' as const },
  { key: 'payments.checkout.order_refunded_body', namespace: 'payments', description: 'Service refund receipt recovery', ...GUEST_CHECKOUT_DRAFTS['payments.checkout.order_refunded_body'], status: 'needs_review' as const },
  { key: 'booking.review.loading_quote', namespace: 'booking', description: 'Guest checkout recovery copy', ...GUEST_CHECKOUT_DRAFTS['booking.review.loading_quote'], status: 'needs_review' as const },
  { key: 'booking.review.retry_quote', namespace: 'booking', description: 'Guest checkout recovery copy', ...GUEST_CHECKOUT_DRAFTS['booking.review.retry_quote'], status: 'needs_review' as const },
  { key: 'payments.checkout.receipt_body', namespace: 'payments', description: 'Guest checkout recovery copy', ...GUEST_CHECKOUT_DRAFTS['payments.checkout.receipt_body'], status: 'needs_review' as const },
  { key: 'payments.checkout.order_success_body', namespace: 'payments', description: 'Guest checkout recovery copy', ...GUEST_CHECKOUT_DRAFTS['payments.checkout.order_success_body'], status: 'needs_review' as const },
  { key: 'payments.checkout.back_to_order', namespace: 'payments', description: 'Guest checkout recovery copy', ...GUEST_CHECKOUT_DRAFTS['payments.checkout.back_to_order'], status: 'needs_review' as const },
];
