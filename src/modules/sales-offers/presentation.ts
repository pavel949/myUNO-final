import type { GuestOffer, GuestOption } from './contracts';
export function offerMoney(amount: number, locale: string) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'THB', minimumFractionDigits: 2 }).format(amount / 100);
}
/** Text, preview and print read the same immutable guest DTO. No URL or private relational IDs. */
export function offerText(offer: GuestOffer, labels: Record<string,string>) {
  const t = (k: string) => labels['sales.'+k];
  const money = (n: number) => offerMoney(n, offer.locale);
  return [t('client_title'), `${t('version')}: ${offer.version}`, `${t('salesperson')}: ${offer.salesperson}`,
    `${t('valid')}: ${offer.expiresAt}`, offer.clientNote,
    ...offer.options.flatMap((o, i) => [
      `${i+1}. ${o.property} · ${o.name}`, `${o.stay.startDate} → ${o.stay.endDate}`,
      `${t('adults')}: ${o.stay.adults} · ${t('children')}: ${o.stay.children} · ${t('pets')}: ${o.stay.pets}`,
      t(o.state), `${t('actual_bedrooms')}: ${o.bedrooms}`,
      ...(o.price ? [
        ...o.price.nights.map(n => `${n.date}: ${money(n.amount)}`),
        ...priceRows(o).map(([key, value]) => `${t(key)}: ${money(value)}`),
        `${t('rules')}: ${o.ruleVersion}`,
        ...(o.price.inclusions?.taxes ? [t('taxes_included')] : []),
        ...(o.price.inclusions?.serviceCharge ? [t('service_included')] : []),
        ...(o.price.inclusions?.breakfast ? [t('breakfast_included')] : []),
      ] : []),
      ...(o.terms ? [t('terms'), o.terms.payment ?? t('payment_unknown'), o.terms.balance ?? '',
        ...(o.terms.minimumNights ? [`${t('minimum_nights')}: ${o.terms.minimumNights}`] : []),
        ...(o.terms.securityDeposit?.thbSatang ? [`${t('security_deposit')}: ${money(o.terms.securityDeposit.thbSatang)}`] : []),
        ...(o.terms.securityDeposit?.usdCents ? [`${t('security_deposit')}: ${new Intl.NumberFormat(offer.locale,{style:'currency',currency:'USD'}).format(o.terms.securityDeposit.usdCents/100)}`] : []),
        t('cancellation'), ...o.terms.cancellation.steps.map(s => `${s.days_before_checkin} / ${s.refund_pct}%`),
        ...o.terms.included, ...o.terms.excluded, o.terms.stayTerms ?? ''] : []),
    ]), t('disclaimer')].filter(Boolean).join('\n');
}
export function priceRows(option: GuestOption): [string,number][] {
  const p = option.price;
  return p ? [['subtotal',p.subtotal],['cleaning',p.cleaning],['service',p.service],['tax',p.tax],
    ['losDiscount',-p.losDiscount],['earlyDiscount',-p.earlyDiscount],['total',p.total]].filter(([key,value])=>!(['losDiscount','earlyDiscount'].includes(String(key))&&value===0)) as [string,number][] : [];
}
