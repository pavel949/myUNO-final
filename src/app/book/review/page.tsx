import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { getConfig } from '@/modules/config';
import { resolveStayCancellationPolicy } from '@/modules/booking';
import BookingReviewClient from './review-client';

export const dynamic = 'force-dynamic';

export default async function BookingReviewPage({
  searchParams,
}: {
  searchParams: {
    unitId?: string;
    inventoryCategoryId?: string;
    categoryId?: string;
    categoryKey?: string;
    projectId?: string;
    startDate?: string;
    endDate?: string;
  };
}) {
  const inventoryCategoryId = searchParams.inventoryCategoryId || searchParams.categoryId;

  if (
    (!searchParams.unitId && !inventoryCategoryId && !searchParams.categoryKey) ||
    !searchParams.startDate ||
    !searchParams.endDate
  ) {
    redirect('/search');
  }

  let projectId = searchParams.projectId;

  if (inventoryCategoryId) {
    const category = await prisma.inventoryCategory.findUnique({
      where: { id: inventoryCategoryId },
      select: { projectId: true, status: true },
    });
    if (!category || category.status !== 'live') redirect('/search');
    if (projectId && projectId !== category.projectId) redirect('/search');
    projectId = category.projectId;
  }

  if (!projectId && searchParams.unitId) {
    const unit = await prisma.unit.findUnique({
      where: { id: searchParams.unitId },
      select: { projectId: true },
    });
    projectId = unit?.projectId;
  }

  // Legacy categoryKey requests still need an explicit project because the key
  // is unique only inside a project. Canonical InventoryCategory ids do not.
  if (!projectId) redirect('/search');

  // A legacy categoryKey link (older bookmarks, emails, external links) is
  // translated to the canonical id and redirected, so it gets the same signed
  // quote as every other category booking instead of a dead review page.
  if (!searchParams.unitId && !inventoryCategoryId && searchParams.categoryKey) {
    const category = await prisma.inventoryCategory.findUnique({
      where: { projectId_categoryKey: { projectId, categoryKey: searchParams.categoryKey } },
      select: { id: true, status: true },
    });
    if (!category || category.status !== 'live') redirect('/search');
    const canonical = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (key !== 'categoryKey' && typeof value === 'string') canonical.set(key, value);
    }
    canonical.set('inventoryCategoryId', category.id);
    redirect(`/book/review?${canonical.toString()}`);
  }

  const enabled =
    (await getConfig(prisma, 'booking.payment.methods_enabled', { projectId })) ?? [
      'cash',
      'bank_transfer',
    ];

  // The exact policy the booking will snapshot (BAR plan > category > unit >
  // configured default). The guest consents to these terms, so the page shows
  // its name and every refund step instead of a generic sentence.
  const policy = await resolveStayCancellationPolicy(
    prisma,
    searchParams.unitId ? { unitId: searchParams.unitId } : { inventoryCategoryId: inventoryCategoryId! }
  ).catch(() => null);

  const labels = await getLabels({
    'booking.review.title': 'Review and confirm',
    'booking.review.policy_step': '{pct}% refund when cancelled at least {days} days before check-in',
    'booking.review.policy_step_last': '{pct}% refund for later cancellations',
    'catalog.cancellation_policies.flexible.label': 'Flexible',
    'catalog.cancellation_policies.moderate.label': 'Moderate',
    'catalog.cancellation_policies.strict.label': 'Strict',
    'booking.review.recap': 'Your stay',
    'booking.review.check_in': 'Check-in',
    'booking.review.check_out': 'Check-out',
    'booking.review.guests': 'Guests',
    'booking.review.policy': 'Cancellation',
    'booking.review.policy_consent':
      'I have read the cancellation terms and agree to book on these dates.',
    'booking.review.verification_note':
      'After you confirm we will ask for guest details so we can file the stay. You are not charged on this screen if you chose cash or bank transfer.',
    'booking.review.confirm': 'Confirm booking',
    'booking.review.confirming': 'Confirming…',
    'booking.review.back': '← Back',
    'booking.review.error': 'Could not complete the booking. Please try again.',
    'booking.review.category_note':
      'We assign a free home in this category when you confirm. The total is calculated on that home.',
    'listing.payment_method': 'Payment method',
    'listing.pay_cash': 'Cash on arrival',
    'listing.pay_card': 'Card (online)',
    'listing.pay_transfer': 'Bank transfer',
    'listing.conflict_title': 'Those dates were just taken',
    'listing.conflict_body': 'Choose other dates and try again.',
    'listing.search_again': 'Search again',
    'listing.total': 'Total',
    'listing.price_nights': '{nights} nights',
    'listing.discount_long_stay': 'Long-stay discount',
    'listing.discount_early_bird': 'Early-bird discount',
    'listing.cleaning_fee': 'Cleaning',
    'listing.occupancy_tax': 'Occupancy tax',
    'listing.cancellation_default': 'The cancellation terms for this home apply.',
  });

  return (
    <Suspense>
      <BookingReviewClient
        projectId={projectId}
        methods={enabled}
        defaultPolicy={
          policy
            ? [
                (labels as Record<string, string>)[`catalog.cancellation_policies.${policy.name}.label`] || policy.name,
                ...[...policy.steps]
                  .sort((a, b) => b.days_before_checkin - a.days_before_checkin)
                  .map(step =>
                    (step.days_before_checkin > 0
                      ? labels['booking.review.policy_step']
                      : labels['booking.review.policy_step_last']
                    )
                      .replace('{pct}', String(step.refund_pct))
                      .replace('{days}', String(step.days_before_checkin))
                  ),
              ].join(' · ')
            : labels['listing.cancellation_default']
        }
        labels={{
          title: labels['booking.review.title'],
          recap: labels['booking.review.recap'],
          checkIn: labels['booking.review.check_in'],
          checkOut: labels['booking.review.check_out'],
          guests: labels['booking.review.guests'],
          policy: labels['booking.review.policy'],
          policyConsent: labels['booking.review.policy_consent'],
          verificationNote: labels['booking.review.verification_note'],
          paymentMethod: labels['listing.payment_method'],
          payCash: labels['listing.pay_cash'],
          payCard: labels['listing.pay_card'],
          payTransfer: labels['listing.pay_transfer'],
          confirm: labels['booking.review.confirm'],
          confirming: labels['booking.review.confirming'],
          back: labels['booking.review.back'],
          error: labels['booking.review.error'],
          conflictTitle: labels['listing.conflict_title'],
          conflictBody: labels['listing.conflict_body'],
          searchAgain: labels['listing.search_again'],
          categoryNote: labels['booking.review.category_note'],
          total: labels['listing.total'],
          nights: labels['listing.price_nights'],
          discountLongStay: labels['listing.discount_long_stay'],
          discountEarlyBird: labels['listing.discount_early_bird'],
          cleaningFee: labels['listing.cleaning_fee'],
          occupancyTax: labels['listing.occupancy_tax'],
        }}
      />
    </Suspense>
  );
}
