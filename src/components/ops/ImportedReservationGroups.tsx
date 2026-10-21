import type { listImportedGroupsForUnits } from '@/modules/integrations/layantara/imported-group.service';

type Group = Awaited<ReturnType<typeof listImportedGroupsForUnits>>[number];
const copy = {
  en: { title: 'Imported group reservations', quote: 'Source group quote (not a receipt)', unknown: 'Villa amount not allocated',
    pending: 'Financial allocation and payment reconciliation pending. Collection, refunds and owner settlement are unavailable.', party: 'Guest counts awaiting confirmation', source: 'Source payment evidence', notes: 'Operational notes' },
  ru: { title: 'Импортированные групповые брони', quote: 'Исходная сумма группы (не платёж)', unknown: 'Сумма по вилле не распределена',
    pending: 'Распределение стоимости и сверка оплаты не завершены. Приём оплаты, возвраты и расчёты с владельцами недоступны.', party: 'Состав гостей требует уточнения', source: 'Данные об оплате из источника', notes: 'Операционные примечания' },
  th: { title: 'การจองกลุ่มที่นำเข้า', quote: 'ยอดจองกลุ่มตามต้นฉบับ (ไม่ใช่ใบรับเงิน)', unknown: 'ยังไม่จัดสรรยอดต่อวิลล่า',
    pending: 'รอจัดสรรราคาและตรวจสอบการชำระเงิน ยังไม่รับชำระ คืนเงิน หรือชำระให้เจ้าของ', party: 'รอยืนยันจำนวนผู้เข้าพัก', source: 'ข้อมูลการชำระเงินจากต้นฉบับ', notes: 'หมายเหตุการปฏิบัติงาน' },
};
export default function ImportedReservationGroups({ groups, locale = 'en' }: { groups: Group[]; locale?: string }) {
  if (!groups.length) return null;
  const labels = copy[locale as keyof typeof copy] ?? copy.en;
  const money = (satang: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'THB' }).format(satang / 100);
  return <section className="stitch-panel space-y-12 p-16" aria-label={labels.title}>
    <h2 className="font-display text-heading-3">{labels.title} ({groups.length})</h2>
    <p className="text-small text-text-secondary">{labels.pending}</p>
    {groups.map(group => <article key={group.id} className="space-y-8 rounded-md border border-border-line p-12">
      <h3 className="font-semibold">{group.sourceReference} · {group.reservationGroup.guest.firstName} {group.reservationGroup.guest.lastName}</h3>
      <p>{labels.quote}: <strong>{money(group.quotedTotalThb)}</strong></p>
      <p className="text-small">{labels.source}: {group.sourcePaymentStatus}{group.reportedPaidThb === null ? '' : ' · ' + money(group.reportedPaidThb)}</p>
      <p className="text-small">{group.adults === null || group.children === null ? labels.party : `${group.adults} / ${group.children}`}</p>
      <ul className="space-y-4">{group.placements.map(placement => <li key={placement.id}>
        {placement.unit.name} · {placement.blockedDate.startDate.toISOString().slice(0,10)} → {placement.blockedDate.endDate.toISOString().slice(0,10)} · {labels.unknown}
      </li>)}</ul>
      {group.reservationGroup.notes ? <p className="whitespace-pre-wrap text-small">{labels.notes}: {group.reservationGroup.notes}</p> : null}
    </article>)}
  </section>;
}
