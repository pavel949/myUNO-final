import { BOOKING_MODE_RELIABILITY_KEYS } from './booking-mode-reliability.seed';
/** Copy added while walking the platform processes end to end. Drafts (needs_review). */
const NR = 'needs_review' as const;
export const WALKTHROUGH_FIX_KEYS = [
  ...BOOKING_MODE_RELIABILITY_KEYS,
  { key: 'service-order.detail.unit_price', namespace: 'service-order', description: 'Field: order unit price', en: 'Unit price', ru: 'Цена за единицу', th: 'ราคาต่อหน่วย', zh: 'Unit price', status: NR },
  { key: 'provider.orders.awaiting_payment', namespace: 'provider', description: 'Provider queue: order not yet paid by the customer', en: 'Waiting for the customer to pay — you can accept once it is paid.', ru: 'Ждём оплату от клиента — принять заказ можно после оплаты.', th: 'รอลูกค้าชำระเงิน — คุณรับงานได้หลังชำระแล้ว', zh: 'Waiting for the customer to pay — you can accept once it is paid.', status: NR },
];

