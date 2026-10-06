import { UI_LOCALE } from '@/lib/format';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Breadcrumb } from '@/components/Breadcrumb';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { MOBILIZATION_STEPS } from '@/modules/core';
import OnboardingClient from './onboarding-client';
import AvailabilityPricingPanel from '@/components/units/AvailabilityPricingPanel';
import TariffPreviewClient from './tariff-preview-client';
import TariffEditorClient from './tariff-editor-client';
import BookingModeClient from './booking-mode-client';

export const dynamic = 'force-dynamic';

/** English fallbacks for the rates and booking-mode panels (content keys, doc 05). */
const COMMERCIAL_LABELS = {
  'admin.tariff_editor.title': 'Rates and seasons',
  'admin.tariff_editor.body': 'These are the prices guests are quoted. Nightly seasons apply to stays under 30 nights; the monthly rate applies from 30 nights, per 30 nights; the 12-month rate is offered by lease request only. Dates are month-day (MM-DD) and repeat every year.',
  'admin.tariff_editor.loading': 'Loading rates…',
  'admin.tariff_editor.load_error': 'Rates could not be loaded. Refresh the page.',
  'admin.tariff_editor.included': 'What the price includes',
  'admin.tariff_editor.includesTaxes': 'Price includes taxes (VAT)',
  'admin.tariff_editor.includesServiceCharge': 'Price includes service charge',
  'admin.tariff_editor.includesBreakfast': 'Breakfast included',
  'admin.tariff_editor.daily_title': 'Nightly seasons',
  'admin.tariff_editor.daily_hint': 'Every night of the year should belong to exactly one season.',
  'admin.tariff_editor.monthly_title': 'Monthly rates (from 30 nights)',
  'admin.tariff_editor.monthly_hint': 'Charged per 30 nights by the season of each night. Leave empty if monthly stays are not offered.',
  'admin.tariff_editor.yearly_title': '12-month lease',
  'admin.tariff_editor.yearly_hint': 'Shown as a lease request; never instant-booked.',
  'admin.tariff_editor.yearly_enabled': 'Offer a 12-month lease rate',
  'admin.tariff_editor.season': 'Season code',
  'admin.tariff_editor.windows': 'Dates (MM-DD)',
  'admin.tariff_editor.from': 'From',
  'admin.tariff_editor.to': 'To',
  'admin.tariff_editor.mm_dd': 'MM-DD',
  'admin.tariff_editor.add_window': '+ dates',
  'admin.tariff_editor.remove': 'Remove',
  'admin.tariff_editor.remove_season': 'Remove season',
  'admin.tariff_editor.add_season': 'Add season',
  'admin.tariff_editor.rate_night': 'THB per night',
  'admin.tariff_editor.rate_30': 'THB per 30 nights',
  'admin.tariff_editor.rate_month': 'THB per month',
  'admin.tariff_editor.minimum': 'Min. nights',
  'admin.tariff_editor.cancellation': 'Cancellation for arrivals in this season (days before arrival → % refunded). Empty = the property\'s standard policy.',
  'admin.tariff_editor.days_before': 'Days before arrival',
  'admin.tariff_editor.days_short': 'days →',
  'admin.tariff_editor.refund_pct': 'Refund %',
  'admin.tariff_editor.add_step': '+ step',
  'admin.tariff_editor.clear_steps': 'Use standard policy',
  'admin.tariff_editor.save_unit': 'Save for this villa',
  'admin.tariff_editor.save_category': 'Save for all {count} villas in this category',
  'admin.tariff_editor.saving': 'Saving…',
  'admin.tariff_editor.saved': 'Saved for {count} villa(s). New quotes use these rates now.',
  'admin.tariff_editor.save_error': 'Rates were not saved. Please try again.',
  'admin.tariff_editor.gaps': '{count} nights of the year have no nightly season and cannot be booked (e.g. {days}).',
  'admin.tariff_editor.daily': 'Nightly',
  'admin.tariff_editor.monthly': 'Monthly',
  'admin.tariff_editor.yearly': '12-month',
  'admin.tariff_editor.flags': 'Inclusions',
  'admin.tariff_editor.error.season_code': '{kind} season “{season}”: use capital letters, digits or _.',
  'admin.tariff_editor.error.season_duplicate': '{kind} season “{season}” is listed twice.',
  'admin.tariff_editor.error.window_missing': '{kind} season “{season}” needs dates.',
  'admin.tariff_editor.error.window_format': '{kind} season “{season}”: dates must be MM-DD, e.g. 11-01.',
  'admin.tariff_editor.error.amount': '{kind} {season}: the rate must be more than 0.',
  'admin.tariff_editor.error.minimum': '{kind} season “{season}”: minimum stay must be at least 1 night.',
  'admin.tariff_editor.error.minimum_monthly': 'Monthly season “{season}”: minimum stay must be at least 30 nights.',
  'admin.tariff_editor.error.minimum_yearly': '12-month lease: minimum stay must be at least 365 nights.',
  'admin.tariff_editor.error.cancellation_steps': '{kind} season “{season}”: cancellation steps need days from most to fewest and refunds of 0–100 %.',
  'admin.tariff_editor.error.overlap': '{kind}: {day} falls in more than one season ({season}).',
  'admin.tariff_editor.error.daily_missing': 'Add at least one nightly season.',
  'admin.tariff_editor.error.flag': 'Choose what the price includes.',
  'admin.booking_mode.title': 'How guests book',
  'admin.booking_mode.instant': 'Instant booking',
  'admin.booking_mode.request': 'Request to book',
  'admin.booking_mode.instant_hint': 'Guests confirm and pay straight away when the dates are free.',
  'admin.booking_mode.request_hint': 'Guests send a request; your team accepts or declines before any payment.',
  'admin.booking_mode.save_unit': 'Save for this villa',
  'admin.booking_mode.save_category': 'Apply to all {count} villas in this category',
  'admin.booking_mode.saved': 'Saved for {count} villa(s).',
  'admin.booking_mode.error': 'Not saved. Please try again.',
};

/**
 * The onboarding workspace for one unit — doc 07 F-OWN-1, seven steps on one
 * screen. It also exposes the canonical commercial graph so operators can see
 * whether this physical unit is actually linked to its sellable category and
 * rate-plan hierarchy rather than silently relying on a legacy category key.
 */
export default async function UnitOnboardingPage({ params }: { params: { id: string } }) {
  const unit = await prisma.unit.findUnique({
    where: { id: params.id },
    include: {
      project: { select: { id: true, name: true } },
      inventoryCategory: true,
      owner: { select: { id: true, firstName: true, lastName: true } },
      engagements: { orderBy: { createdAt: 'desc' } },
      complianceRecords: { orderBy: { createdAt: 'desc' } },
      mobilizationChecklist: true,
    },
  });

  if (!unit) notFound();

  const ratePlans = await prisma.ratePlan.findMany({
    where: {
      status: 'active',
      OR: [
        { unitId: unit.id },
        ...(unit.inventoryCategoryId ? [{ categoryId: unit.inventoryCategoryId }] : []),
        { projectId: unit.projectId, unitId: null, categoryId: null },
      ],
    },
    orderBy: [{ isMaster: 'desc' }, { code: 'asc' }],
  });

  const [commercialLabels, categoryUnits] = await Promise.all([
    getLabels(COMMERCIAL_LABELS),
    unit.inventoryCategoryId
      ? prisma.unit.count({ where: { inventoryCategoryId: unit.inventoryCategoryId, status: { not: 'offboarded' } } })
      : Promise.resolve(1),
  ]);
  const labels = await getLabels({
    'admin.units.breadcrumb_home': 'Home',
    'admin.units.breadcrumb_admin': 'Admin',
    'admin.units.breadcrumb_units': 'Units',
    'admin.units.breadcrumb_detail': 'Unit Details',
    'admin.onboarding.title': 'Onboarding',
    'admin.gallery.manage': 'Manage photos and galleries',
    'admin.onboarding.back': 'All units',
    'admin.onboarding.step': 'Step',
    'admin.onboarding.done': 'Done',
    'admin.onboarding.pending': 'Pending',
    'admin.onboarding.blocked': 'Blocked',
    'admin.onboarding.start_checklist': 'Start the checklist',
    'admin.onboarding.no_checklist': 'This unit has no mobilization checklist yet.',
    'admin.onboarding.complete_step': 'Mark done',
    'admin.onboarding.notes': 'Notes',
    'admin.onboarding.owner_title': 'Owner',
    'admin.onboarding.owner_none': 'No owner set. A mandate cannot be recorded without one.',
    'admin.onboarding.owner_set': 'Set owner',
    'admin.onboarding.owner_email': 'Owner email',
    'admin.onboarding.engagement_title': 'Mandate (engagement)',
    'admin.onboarding.engagement_none':
      'No engagement. Owner statements cannot be generated until one exists.',
    'admin.onboarding.engagement_type': 'Engagement type',
    'admin.onboarding.noi_cap': 'NOI cap per year (THB)',
    'admin.onboarding.noi_cap_hint': 'Required for direct-managed. No default — it must be agreed.',
    'admin.onboarding.record_engagement': 'Record mandate',
    'admin.onboarding.compliance_title': 'Compliance records',
    'admin.onboarding.compliance_none': 'No records yet.',
    'admin.onboarding.record_type': 'Record type',
    'admin.onboarding.label': 'Label',
    'admin.onboarding.expires': 'Expires on',
    'admin.onboarding.add_record': 'Add record',
    'admin.onboarding.confirm_record': 'Confirm',
    'admin.onboarding.permitted_use_warning':
      'Permitted use is confirmed, but no permitted-use record is attached.',
    'admin.onboarding.error_generic': 'Action failed. Please try again.',
    'admin.onboarding.saving': 'Saving…',
    'admin.unit360.graph_title': 'Canonical property graph',
    'admin.unit360.graph_hint': 'Project → Inventory category → Unit → Rate plan',
    'admin.unit360.project': 'Project',
    'admin.unit360.category': 'Inventory category',
    'admin.unit360.category_linked': 'Canonical link active',
    'admin.unit360.category_legacy': 'Legacy category key only',
    'admin.unit360.category_none': 'No category assigned',
    'admin.unit360.rate_plans': 'Applicable rate plans',
    'admin.unit360.base_rate': 'Unit base rate',
    'admin.unit360.min_stay': 'Unit minimum stay',
    'admin.unit360.legacy_warning':
      'This unit still has a legacy category key without an InventoryCategory link. Re-save the category after the canonical category exists.',
    'staff.calendar.title': 'Availability & pricing',
    'staff.calendar.intro':
      'Block this unit for maintenance or an owner stay, or set a one-off rate for a date range.',
    'staff.calendar.loading': 'Loading…',
    'staff.calendar.error_generic': 'Something went wrong. Please try again.',
    'staff.calendar.saving': 'Saving…',
    'staff.calendar.blocks_title': 'Blocked dates',
    'staff.calendar.blocks_none': 'No blocked dates.',
    'staff.calendar.reason.maintenance': 'Maintenance',
    'staff.calendar.reason.owner_hold': 'Owner hold',
    'staff.calendar.reason.other': 'Other',
    'staff.calendar.start_date': 'Start date',
    'staff.calendar.end_date': 'End date',
    'staff.calendar.reason_field': 'Reason',
    'staff.calendar.note': 'Note (optional)',
    'staff.calendar.add_block': 'Block these dates',
    'staff.calendar.remove': 'Remove',
    'staff.calendar.pricing_title': 'Pricing overrides',
    'staff.calendar.pricing_none': 'No pricing overrides.',
    'staff.calendar.per_night': '/night',
    'staff.calendar.nightly_rate': 'Nightly rate (THB)',
    'staff.calendar.label': 'Label (optional)',
    'staff.calendar.add_rule': 'Add rate',
    'admin.tariff_preview.title': 'Seasonal tariff and booking-policy preview',
    'admin.tariff_preview.mode': 'Tariff mode',
    'admin.tariff_preview.daily': 'Daily',
    'admin.tariff_preview.monthly': 'Monthly',
    'admin.tariff_preview.yearly': '12-month lease',
    'admin.tariff_preview.arrival': 'Check-in',
    'admin.tariff_preview.departure': 'Check-out',
    'admin.tariff_preview.preview': 'Preview quote',
    'admin.tariff_preview.draft': 'Preview only. Draft tariffs do not create bookings or authorize channel activation.',
    'admin.tariff_preview.total': 'Illustrative total',
    'admin.tariff_preview.minimum': 'Minimum stay',
    'admin.tariff_preview.failure': 'Unable to calculate the tariff.',
    'admin.tariff_preview.terms': 'Cancellation terms',
    'admin.tariff_preview.deposit': 'Refundable security deposit',
    'admin.tariff_preview.confirmation': 'Confirmation payment',

  });

  const checklistByStep = Object.fromEntries(
    unit.mobilizationChecklist.map((item) => [item.step, item])
  );

  const breadcrumbs = [
    { label: labels['admin.units.breadcrumb_home'], href: '/' },
    { label: labels['admin.units.breadcrumb_admin'], href: '/app/admin' },
    { label: labels['admin.units.breadcrumb_units'], href: '/app/admin/units' },
    { label: labels['admin.units.breadcrumb_detail'], current: true },
  ];

  const categoryState = unit.inventoryCategory
    ? labels['admin.unit360.category_linked']
    : unit.categoryKey
      ? labels['admin.unit360.category_legacy']
      : labels['admin.unit360.category_none'];

  return (
    <div>
      <Breadcrumb items={breadcrumbs} />
      <Link href="/app/admin/units" className="text-small text-text-secondary hover:underline">
        ← {labels['admin.onboarding.back']}
      </Link>
      <h1 className="font-display text-display-xl font-semibold text-text-ink mt-8 mb-24">
        {unit.name} · {labels['admin.onboarding.title']}
      </h1>
      <Link href={`/app/admin/properties/${unit.project.id}/onboarding?gallery=unit:${unit.id}#step-7`}
        className="inline-block mb-24 rounded-md border border-border-line px-16 py-12 text-brand-andaman">
        {labels['admin.gallery.manage']} →
      </Link>

      <section className="bg-surface-paper border border-border-line rounded-lg shadow-card p-24 mb-24">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-12 mb-16">
          <div>
            <h2 className="text-heading-3 font-semibold text-text-ink">
              {labels['admin.unit360.graph_title']}
            </h2>
            <p className="text-small text-text-secondary">{labels['admin.unit360.graph_hint']}</p>
          </div>
          <Link
            href={`/app/admin/projects/${unit.project.id}`}
            className="text-small text-brand-andaman hover:underline"
          >
            {unit.project.name} →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-12">
          <div className="p-12 bg-surface-ivory border border-border-line rounded-md">
            <p className="text-small text-text-secondary">{labels['admin.unit360.project']}</p>
            <p className="font-semibold text-text-ink">{unit.project.name}</p>
          </div>
          <div className="p-12 bg-surface-ivory border border-border-line rounded-md">
            <p className="text-small text-text-secondary">{labels['admin.unit360.category']}</p>
            <p className="font-semibold text-text-ink">
              {unit.inventoryCategory?.name || unit.categoryKey || '—'}
            </p>
            <p className="text-small text-text-secondary">{categoryState}</p>
          </div>
          <div className="p-12 bg-surface-ivory border border-border-line rounded-md">
            <p className="text-small text-text-secondary">{labels['admin.unit360.rate_plans']}</p>
            <p className="font-semibold text-text-ink">{ratePlans.length}</p>
            <p className="text-small text-text-secondary">
              {ratePlans.map((plan) => plan.code).join(', ') || '—'}
            </p>
          </div>
          <div className="p-12 bg-surface-ivory border border-border-line rounded-md">
            <p className="text-small text-text-secondary">{labels['admin.unit360.base_rate']}</p>
            <p className="font-semibold text-text-ink">฿{Math.round(unit.baseNightlyThb / 100).toLocaleString(UI_LOCALE)}</p>
          </div>
          <div className="p-12 bg-surface-ivory border border-border-line rounded-md">
            <p className="text-small text-text-secondary">{labels['admin.unit360.min_stay']}</p>
            <p className="font-semibold text-text-ink">{unit.minNights}</p>
          </div>
        </div>

        {!unit.inventoryCategory && unit.categoryKey ? (
          <div className="mt-12 p-12 bg-state-warning-soft border border-state-warning rounded-md text-small text-text-ink">
            {labels['admin.unit360.legacy_warning']}
          </div>
        ) : null}
      </section>

      <OnboardingClient
        unitId={unit.id}
        labels={labels}
        steps={MOBILIZATION_STEPS.map((step) => {
          const item = checklistByStep[step];
          return {
            step,
            itemId: item?.id ?? null,
            status: item?.status ?? null,
            notes: item?.notes ?? null,
            completedAt: item?.completedAt?.toISOString() ?? null,
          };
        })}
        owner={
          unit.owner
            ? { id: unit.owner.id, name: `${unit.owner.firstName} ${unit.owner.lastName}` }
            : null
        }
        engagements={unit.engagements.map((e) => ({
          id: e.id,
          engagementType: e.engagementType,
          status: e.status,
          noiCapAnnualBaht: e.noiCapAnnualThb !== null ? Math.round(e.noiCapAnnualThb / 100) : null,
        }))}
        complianceRecords={unit.complianceRecords.map((r) => ({
          id: r.id,
          recordType: r.recordType,
          status: r.status,
          label: r.label,
          expiresOn: r.expiresOn?.toISOString() ?? null,
        }))}
        permittedUseConfirmed={Boolean(unit.permittedUseConfirmedAt)}
      />

      <div className="mt-32">
        <BookingModeClient unitId={unit.id} instantBook={unit.instantBook} categoryUnits={categoryUnits} labels={commercialLabels} />
        <TariffEditorClient unitId={unit.id} labels={commercialLabels} />
        <AvailabilityPricingPanel unitId={unit.id} labels={labels} />
        <TariffPreviewClient unitId={unit.id} labels={{
          title: labels['admin.tariff_preview.title'],
          mode: labels['admin.tariff_preview.mode'],
          daily: labels['admin.tariff_preview.daily'],
          monthly: labels['admin.tariff_preview.monthly'],
          yearly: labels['admin.tariff_preview.yearly'],
          arrival: labels['admin.tariff_preview.arrival'],
          departure: labels['admin.tariff_preview.departure'],
          preview: labels['admin.tariff_preview.preview'],
          draft: labels['admin.tariff_preview.draft'],
          total: labels['admin.tariff_preview.total'],
          minimum: labels['admin.tariff_preview.minimum'],
          failure: labels['admin.tariff_preview.failure'],
          terms: labels['admin.tariff_preview.terms'],
          deposit: labels['admin.tariff_preview.deposit'],
          confirmation: labels['admin.tariff_preview.confirmation'],
        }} />
      </div>
    </div>
  );
}
