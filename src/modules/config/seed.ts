/**
 * Seed all configuration parameters from doc 04
 * This is called by seed.ts after basic setup
 */

import { PrismaClient, Prisma } from '@prisma/client';

export async function seedConfig(db: PrismaClient) {
  // Clear existing parameters to ensure idempotency
  await db.configParameter.deleteMany();

  // Group: booking
  await db.configParameter.createMany({
    data: [
      {
        key: 'booking.hold_minutes',
        valueType: 'int',
        defaultValue: 30,
        scopeableTo: 'project',
        groupKey: 'booking',
        description: 'How long an unpaid pending_payment booking blocks the calendar before expiring',
      },
      {
        key: 'booking.request_hours',
        valueType: 'int',
        defaultValue: 24,
        scopeableTo: 'project',
        groupKey: 'booking',
        description: 'Request-to-book: hours the host/ops side has to approve before auto-decline',
      },
      {
        key: 'booking.requests_block_calendar',
        valueType: 'boolean',
        defaultValue: false,
        scopeableTo: 'project',
        groupKey: 'booking',
        description: 'Whether un-answered requests block availability',
      },
      {
        key: 'booking.min_nights_default',
        valueType: 'int',
        defaultValue: 2,
        scopeableTo: 'unit',
        groupKey: 'booking',
        description: 'Default minimum stay for new units',
      },
      {
        key: 'booking.max_advance_days',
        valueType: 'int',
        defaultValue: 365,
        scopeableTo: 'project',
        groupKey: 'booking',
        description: 'How far ahead stays can be booked',
      },
      {
        key: 'booking.payment.methods_enabled',
        valueType: 'json',
        defaultValue: ['cash'],
        scopeableTo: 'project',
        groupKey: 'booking',
        description: 'Which payment methods are offered',
      },
      {
        key: 'booking.payment.cash_receipt_required',
        valueType: 'boolean',
        defaultValue: true,
        scopeableTo: 'project',
        groupKey: 'booking',
        description: 'Require a receipt/чек reference when cash is accepted',
      },
      {
        key: 'booking.cash_due_blocks_checkin',
        valueType: 'boolean',
        defaultValue: true,
        scopeableTo: 'project',
        groupKey: 'booking',
        description: 'Whether check-in is gated on cash being collected',
      },
      {
        key: 'booking.same_day_cutoff_hour',
        valueType: 'int',
        defaultValue: 16,
        scopeableTo: 'project',
        groupKey: 'booking',
        description: 'Latest hour a same-day check-in can be booked',
      },
      {
        key: 'booking.deposit.mode',
        valueType: 'enum',
        defaultValue: 'off',
        enumOptions: ['off', 'preauth'],
        scopeableTo: 'unit',
        groupKey: 'booking',
        description: 'Security deposit handling mode',
      },
      {
        key: 'booking.deposit.amount_thb',
        valueType: 'money_thb',
        defaultValue: 0,
        scopeableTo: 'unit',
        groupKey: 'booking',
        description: 'Pre-auth amount when mode is preauth',
      },
      {
        key: 'booking.checkin_hour',
        valueType: 'int',
        defaultValue: 15,
        scopeableTo: 'unit',
        groupKey: 'booking',
        description: 'Standard check-in time',
      },
      {
        key: 'booking.checkout_hour',
        valueType: 'int',
        defaultValue: 11,
        scopeableTo: 'unit',
        groupKey: 'booking',
        description: 'Standard check-out time',
      },
      {
        key: 'owner_stay.charge_cleaning',
        valueType: 'boolean',
        defaultValue: true,
        scopeableTo: 'project',
        groupKey: 'booking',
        description: 'Whether post-owner-stay turnover clean is charged',
      },
      {
        key: 'owner_stay.notice_hours',
        valueType: 'int',
        defaultValue: 48,
        scopeableTo: 'project',
        groupKey: 'booking',
        description: 'Minimum notice for an owner to book their own unit',
      },
    ],
  });

  // Group: engagement
  await db.configParameter.createMany({
    data: [
      {
        key: 'engagement.direct.noi_cap_annual_thb',
        valueType: 'money_thb',
        defaultValue: Prisma.DbNull,
        scopeableTo: 'global',
        groupKey: 'engagement',
        description: 'Annual NOI cap for direct-managed units (no default, set per unit)',
      },
      {
        key: 'engagement.direct.setup_fee_thb',
        valueType: 'money_thb',
        defaultValue: 0,
        scopeableTo: 'project',
        groupKey: 'engagement',
        description: 'One-time mobilization/setup fee',
      },
      {
        key: 'engagement.via_mc.platform_fee_pct',
        valueType: 'percent',
        defaultValue: 12,
        scopeableTo: 'project',
        groupKey: 'engagement',
        description: 'myUNO platform fee on rental revenue of MC-listed units',
      },
      {
        key: 'engagement.via_mc.mc_sees_owner_statement',
        valueType: 'boolean',
        defaultValue: false,
        scopeableTo: 'project',
        groupKey: 'engagement',
        description: 'Whether MC staff can view owner statements',
      },
      {
        key: 'engagement.owner_direct.booking_fee_pct',
        valueType: 'percent',
        defaultValue: 10,
        scopeableTo: 'project',
        groupKey: 'engagement',
        description: 'myUNO fee on bookings of owner-direct listings',
      },
      {
        key: 'engagement.seasonal_markup_share_pct',
        valueType: 'percent',
        defaultValue: 100,
        scopeableTo: 'project',
        groupKey: 'engagement',
        description: 'Share of season markup revenue treated as Estate before NOI split',
      },
    ],
  });

  // Group: pricing
  const defaultSeasonCalendar = [
    { name: 'peak', from: '12-15', to: '01-15', markup_pct: 60 },
    { name: 'high', from: '11-01', to: '04-30', markup_pct: 25 },
    { name: 'shoulder', from: '05-01', to: '06-30', markup_pct: 10 },
    { name: 'low', from: '07-01', to: '10-31', markup_pct: 0 },
  ];

  await db.configParameter.createMany({
    data: [
      {
        key: 'pricing.season.calendar',
        valueType: 'schedule',
        defaultValue: defaultSeasonCalendar,
        scopeableTo: 'project,unit',
        groupKey: 'pricing',
        description: 'Season calendar with named price periods',
      },
      {
        key: 'pricing.los_discount.weekly_pct',
        valueType: 'percent',
        defaultValue: 5,
        scopeableTo: 'unit',
        groupKey: 'pricing',
        description: 'Length-of-stay discount for >= 7 nights',
      },
      {
        key: 'pricing.los_discount.monthly_pct',
        valueType: 'percent',
        defaultValue: 20,
        scopeableTo: 'unit',
        groupKey: 'pricing',
        description: 'Length-of-stay discount for >= 28 nights',
      },
      {
        key: 'pricing.cleaning_fee_thb',
        valueType: 'money_thb',
        defaultValue: 0,
        scopeableTo: 'unit',
        groupKey: 'pricing',
        description: 'Per-stay cleaning fee',
      },
      {
        key: 'pricing.guest_service_fee_pct',
        valueType: 'percent',
        defaultValue: 0,
        scopeableTo: 'project',
        groupKey: 'pricing',
        description: 'Optional guest-facing service fee',
      },
    ],
  });

  // Group: cancellation
  const flexiblePolicy = [
    { days: 1, pct: 100 },
    { days: 0, pct: 0 },
  ];
  const moderatePolicy = [
    { days: 5, pct: 100 },
    { days: 0, pct: 50 },
  ];
  const strictPolicy = [
    { days: 14, pct: 50 },
    { days: 0, pct: 0 },
  ];

  await db.configParameter.createMany({
    data: [
      {
        key: 'cancellation.policy.flexible',
        valueType: 'schedule',
        defaultValue: flexiblePolicy,
        scopeableTo: 'global',
        groupKey: 'cancellation',
        description: 'Flexible cancellation policy',
      },
      {
        key: 'cancellation.policy.moderate',
        valueType: 'schedule',
        defaultValue: moderatePolicy,
        scopeableTo: 'global',
        groupKey: 'cancellation',
        description: 'Moderate cancellation policy',
      },
      {
        key: 'cancellation.policy.strict',
        valueType: 'schedule',
        defaultValue: strictPolicy,
        scopeableTo: 'global',
        groupKey: 'cancellation',
        description: 'Strict cancellation policy',
      },
      {
        key: 'cancellation.default_policy',
        valueType: 'enum',
        defaultValue: 'moderate',
        enumOptions: ['flexible', 'moderate', 'strict'],
        scopeableTo: 'unit',
        groupKey: 'cancellation',
        description: 'Default policy for new units',
      },
      {
        key: 'cancellation.host_cancel_full_refund',
        valueType: 'boolean',
        defaultValue: true,
        scopeableTo: 'global',
        groupKey: 'cancellation',
        description: 'Platform/host-side cancellation always refunds 100%',
      },
      {
        key: 'cancellation.no_show_treated_as',
        valueType: 'enum',
        defaultValue: 'late_cancel',
        enumOptions: ['late_cancel', 'forfeit'],
        scopeableTo: 'project',
        groupKey: 'cancellation',
        description: 'No-show refund treatment',
      },
      {
        key: 'service.cancel_window_hours',
        valueType: 'int',
        defaultValue: 24,
        scopeableTo: 'project',
        groupKey: 'cancellation',
        description: 'Service orders: full refund window',
      },
      {
        key: 'service.provider_no_show_refund_pct',
        valueType: 'percent',
        defaultValue: 100,
        scopeableTo: 'global',
        groupKey: 'cancellation',
        description: 'Provider no-show refund percentage',
      },
      {
        key: 'service.accept_sla_hours',
        valueType: 'int',
        defaultValue: 12,
        scopeableTo: 'project',
        groupKey: 'cancellation',
        description: 'Hours provider has to accept order',
      },
    ],
  });

  // Group: services
  await db.configParameter.createMany({
    data: [
      {
        key: 'services.take_rate_pct',
        valueType: 'percent',
        defaultValue: 15,
        scopeableTo: 'project',
        groupKey: 'services',
        description: 'myUNO commission on service orders',
      },
      {
        key: 'services.advance_notice_hours_default',
        valueType: 'int',
        defaultValue: 24,
        scopeableTo: 'project',
        groupKey: 'services',
        description: 'Default earliest bookable slot',
      },
      {
        key: 'services.require_admin_approval',
        valueType: 'boolean',
        defaultValue: true,
        scopeableTo: 'global',
        groupKey: 'services',
        description: 'Require admin approval for new/edited services',
      },
      {
        key: 'services.payout_period',
        valueType: 'enum',
        defaultValue: 'weekly',
        enumOptions: ['weekly', 'biweekly', 'monthly'],
        scopeableTo: 'global',
        groupKey: 'services',
        description: 'Provider remittance cadence',
      },
      {
        key: 'tickets.sla_hours.urgent',
        valueType: 'int',
        defaultValue: 4,
        scopeableTo: 'project',
        groupKey: 'services',
        description: 'Urgent ticket SLA in hours',
      },
      {
        key: 'tickets.sla_hours.high',
        valueType: 'int',
        defaultValue: 24,
        scopeableTo: 'project',
        groupKey: 'services',
        description: 'High priority ticket SLA in hours',
      },
      {
        key: 'tickets.sla_hours.normal',
        valueType: 'int',
        defaultValue: 72,
        scopeableTo: 'project',
        groupKey: 'services',
        description: 'Normal ticket SLA in hours',
      },
      {
        key: 'tickets.sla_hours.low',
        valueType: 'int',
        defaultValue: 168,
        scopeableTo: 'project',
        groupKey: 'services',
        description: 'Low priority ticket SLA in hours',
      },
      {
        key: 'tickets.default_assignee',
        valueType: 'enum',
        defaultValue: 'project_ops_lead',
        enumOptions: ['unassigned', 'project_ops_lead'],
        scopeableTo: 'project',
        groupKey: 'services',
        description: 'Auto-assignment target on creation',
      },
      {
        key: 'tickets.auto_close_resolved_days',
        valueType: 'int',
        defaultValue: 7,
        scopeableTo: 'global',
        groupKey: 'services',
        description: 'Auto-close resolved tickets after N days',
      },
      {
        key: 'messaging.response_sla_hours',
        valueType: 'int',
        defaultValue: 4,
        scopeableTo: 'project',
        groupKey: 'services',
        description: 'Guest-inquiry response SLA',
      },
    ],
  });

  // Group: finance, compliance, notify, auth, i18n
  await db.configParameter.createMany({
    data: [
      {
        key: 'finance.statement.day_of_month',
        valueType: 'int',
        defaultValue: 5,
        scopeableTo: 'global',
        groupKey: 'finance',
        description: 'Day statements are generated as drafts',
      },
      {
        key: 'finance.statement.requires_admin_signoff',
        valueType: 'boolean',
        defaultValue: true,
        scopeableTo: 'global',
        groupKey: 'finance',
        description: 'Draft → published requires admin action',
      },
      {
        key: 'finance.occupancy_tax_pct',
        valueType: 'percent',
        defaultValue: 0,
        scopeableTo: 'project',
        groupKey: 'finance',
        description: 'Occupancy/local tax line if applicable',
      },
      {
        key: 'finance.payout.default_thb_account',
        valueType: 'string',
        defaultValue: 'Bank of Ayudhya (Krungsri) 475-1-22131-3 · SWIFT AYUDTHBK',
        scopeableTo: 'global',
        groupKey: 'finance',
        description: 'Default THB payout account',
      },
      {
        key: 'compliance.tm30_sla_hours',
        valueType: 'int',
        defaultValue: 24,
        scopeableTo: 'global',
        groupKey: 'compliance',
        description: 'Legal deadline for TM30 (only tightenable)',
      },
      {
        key: 'compliance.tm30_escalation_hours_before',
        valueType: 'int',
        defaultValue: 6,
        scopeableTo: 'global',
        groupKey: 'compliance',
        description: 'Hours before due_at an unfiled TM30 escalates',
      },
      {
        key: 'compliance.passport_required_hours_before_checkin',
        valueType: 'int',
        defaultValue: 24,
        scopeableTo: 'project',
        groupKey: 'compliance',
        description: 'Pre-arrival passport deadline',
      },
      {
        key: 'retention.passport_media_days_after_checkout',
        valueType: 'int',
        defaultValue: 30,
        scopeableTo: 'global',
        groupKey: 'compliance',
        description: 'Auto-deletion deadline for passport images',
      },
      {
        key: 'notify.channel.email.enabled',
        valueType: 'boolean',
        defaultValue: true,
        scopeableTo: 'global',
        groupKey: 'notify',
        description: 'Email channel enabled',
      },
      {
        key: 'notify.channel.whatsapp.enabled',
        valueType: 'boolean',
        defaultValue: false,
        scopeableTo: 'global',
        groupKey: 'notify',
        description: 'WhatsApp channel enabled',
      },
      {
        key: 'notify.channel.telegram.enabled',
        valueType: 'boolean',
        defaultValue: false,
        scopeableTo: 'global',
        groupKey: 'notify',
        description: 'Telegram channel enabled',
      },
      {
        key: 'auth.token_ttl_minutes.password_reset',
        valueType: 'int',
        defaultValue: 60,
        scopeableTo: 'global',
        groupKey: 'auth',
        description: 'Password reset token TTL',
      },
      {
        key: 'auth.token_ttl_minutes.email_verify',
        valueType: 'int',
        defaultValue: 1440,
        scopeableTo: 'global',
        groupKey: 'auth',
        description: 'Email verification token TTL',
      },
      {
        key: 'auth.token_ttl_minutes.account_claim',
        valueType: 'int',
        defaultValue: 10080,
        scopeableTo: 'global',
        groupKey: 'auth',
        description: 'Account claim token TTL (7 days)',
      },
      {
        key: 'i18n.default_locale',
        valueType: 'enum',
        defaultValue: 'ru',
        enumOptions: ['ru', 'en', 'th'],
        scopeableTo: 'global',
        groupKey: 'i18n',
        description: 'New-visitor default language',
      },
      {
        key: 'analytics.buyer_signal.repeat_stay_threshold',
        valueType: 'int',
        defaultValue: 2,
        scopeableTo: 'global',
        groupKey: 'analytics',
        description: 'Completed stays threshold for repeat_stay signal',
      },
      {
        key: 'analytics.buyer_signal.long_stay_nights',
        valueType: 'int',
        defaultValue: 28,
        scopeableTo: 'global',
        groupKey: 'analytics',
        description: 'Nights that make a stay a long_stay signal',
      },
    ],
  });

  // Group: catalogs (doc 04 §8)
  const amenitiesCatalog = [
    { key: 'pool', icon: 'waves' },
    { key: 'sea_view', icon: 'eye' },
    { key: 'gym', icon: 'dumbbell' },
    { key: 'parking', icon: 'car' },
    { key: 'wifi', icon: 'wifi' },
    { key: 'aircon', icon: 'wind' },
    { key: 'kitchen', icon: 'utensils' },
    { key: 'washer', icon: 'shirt' },
    { key: 'workspace', icon: 'laptop' },
    { key: 'kids_friendly', icon: 'children' },
    { key: 'pets_allowed', icon: 'paw' },
    { key: 'security_24h', icon: 'shield' },
  ];

  const serviceCategoriesCatalog = [
    { key: 'transfer', icon: 'car' },
    { key: 'car_hire', icon: 'car' },
    { key: 'cleaning', icon: 'broom' },
    { key: 'chef', icon: 'chef' },
    { key: 'tours', icon: 'map' },
    { key: 'yacht', icon: 'ship' },
    { key: 'flowers', icon: 'flower' },
    { key: 'water_delivery', icon: 'droplet' },
    { key: 'laundry', icon: 'shirt' },
    { key: 'babysitting', icon: 'children' },
    { key: 'massage_spa', icon: 'spa' },
    { key: 'repairs', icon: 'wrench' },
    { key: 'emergency_medical', icon: 'plus' },
  ];

  const ticketCategoriesCatalog = [
    { key: 'maintenance' },
    { key: 'housekeeping' },
    { key: 'complaint' },
    { key: 'billing_question' },
    { key: 'access' },
    { key: 'noise' },
    { key: 'common_area' },
    { key: 'other' },
  ];

  const unitTypesCatalog = [
    { key: 'villa' },
    { key: 'condo' },
    { key: 'townhouse' },
  ];

  const cancellationPoliciesCatalog = [
    { key: 'flexible' },
    { key: 'moderate' },
    { key: 'strict' },
  ];

  await db.configParameter.createMany({
    data: [
      {
        key: 'catalog.amenities',
        valueType: 'json',
        defaultValue: amenitiesCatalog,
        scopeableTo: 'global',
        groupKey: 'catalogs',
        description: 'Amenities catalog',
      },
      {
        key: 'catalog.service_categories',
        valueType: 'json',
        defaultValue: serviceCategoriesCatalog,
        scopeableTo: 'global',
        groupKey: 'catalogs',
        description: 'Service categories catalog',
      },
      {
        key: 'catalog.ticket_categories',
        valueType: 'json',
        defaultValue: ticketCategoriesCatalog,
        scopeableTo: 'global',
        groupKey: 'catalogs',
        description: 'Ticket categories catalog',
      },
      {
        key: 'catalog.unit_types',
        valueType: 'json',
        defaultValue: unitTypesCatalog,
        scopeableTo: 'global',
        groupKey: 'catalogs',
        description: 'Unit types catalog',
      },
      {
        key: 'catalog.cancellation_policies',
        valueType: 'json',
        defaultValue: cancellationPoliciesCatalog,
        scopeableTo: 'global',
        groupKey: 'catalogs',
        description: 'Cancellation policies catalog',
      },
    ],
  });

  console.log('✓ Configuration parameters seeded');
}
