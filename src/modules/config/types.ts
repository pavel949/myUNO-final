/**
 * Configuration parameter types — mirrors doc 04 § 1–8
 * Every parameter here has a corresponding seed in prisma/seed.ts
 */

export type ConfigScope = 'global' | 'project' | 'unit';

export interface ConfigParamDef<T = any> {
  key: string;
  type: string;
  defaultValue: T;
  scopeableTo: ConfigScope[];
  groupKey: string;
  description: string;
  enumOptions?: any;
  jsonSchema?: any;
}

// Booking group — stay rules (doc 04 §2)
export interface BookingConfig {
  'booking.hold_minutes': number;
  'booking.request_hours': number;
  'booking.requests_block_calendar': boolean;
  'booking.min_nights_default': number;
  'booking.max_advance_days': number;
  'booking.payment.methods_enabled': ('cash' | 'card_provider')[];
  'booking.payment.cash_receipt_required': boolean;
  'booking.cash_due_blocks_checkin': boolean;
  'booking.same_day_cutoff_hour': number;
  'booking.deposit.mode': 'off' | 'preauth';
  'booking.deposit.amount_thb': number;
  'booking.checkin_hour': number;
  'booking.checkout_hour': number;
  'owner_stay.charge_cleaning': boolean;
  'owner_stay.notice_hours': number;
}

// Engagement group — commissions (doc 04 §3)
export interface EngagementConfig {
  'engagement.direct.noi_cap_annual_thb': number | null;
  'engagement.direct.setup_fee_thb': number;
  'engagement.via_mc.platform_fee_pct': number;
  'engagement.via_mc.mc_sees_owner_statement': boolean;
  'engagement.owner_direct.booking_fee_pct': number;
  'engagement.seasonal_markup_share_pct': number;
}

// Pricing group — seasons and rates (doc 04 §4)
export interface SeasonPeriod {
  name: string;
  from: string; // MM-DD format
  to: string; // MM-DD format
  markup_pct: number;
}

export interface PricingConfig {
  'pricing.season.calendar': SeasonPeriod[];
  'pricing.los_discount.weekly_pct': number;
  'pricing.los_discount.monthly_pct': number;
  'pricing.cleaning_fee_thb': number;
  'pricing.guest_service_fee_pct': number;
}

// Cancellation group — policies (doc 04 §5)
export interface CancellationStep {
  days: number;
  pct: number;
}

export interface CancellationConfig {
  'cancellation.policy.flexible': CancellationStep[];
  'cancellation.policy.moderate': CancellationStep[];
  'cancellation.policy.strict': CancellationStep[];
  'cancellation.default_policy': 'flexible' | 'moderate' | 'strict';
  'cancellation.host_cancel_full_refund': boolean;
  'cancellation.no_show_treated_as': 'late_cancel' | 'forfeit';
  'service.cancel_window_hours': number;
  'service.provider_no_show_refund_pct': number;
  'service.accept_sla_hours': number;
}

// Services & tickets — marketplace and SLAs (doc 04 §6)
export interface ServicesConfig {
  'services.take_rate_pct': number;
  'services.advance_notice_hours_default': number;
  'services.require_admin_approval': boolean;
  'services.payout_period': 'weekly' | 'biweekly' | 'monthly';
  'tickets.sla_hours.urgent': number;
  'tickets.sla_hours.high': number;
  'tickets.sla_hours.normal': number;
  'tickets.sla_hours.low': number;
  'tickets.default_assignee': 'unassigned' | 'project_ops_lead';
  'tickets.auto_close_resolved_days': number;
  'messaging.response_sla_hours': number;
}

// Finance, compliance, etc. (doc 04 §7)
export interface OtherConfig {
  'finance.statement.day_of_month': number;
  'finance.statement.requires_admin_signoff': boolean;
  'finance.occupancy_tax_pct': number;
  'finance.payout.default_thb_account': string;
  'compliance.tm30_sla_hours': number;
  'compliance.tm30_escalation_hours_before': number;
  'compliance.passport_required_hours_before_checkin': number;
  'retention.passport_media_days_after_checkout': number;
  'notify.channel.email.enabled': boolean;
  'notify.channel.whatsapp.enabled': boolean;
  'notify.channel.telegram.enabled': boolean;
  'auth.token_ttl_minutes.password_reset': number;
  'auth.token_ttl_minutes.email_verify': number;
  'auth.token_ttl_minutes.account_claim': number;
  'i18n.default_locale': 'ru' | 'en' | 'th';
  'analytics.buyer_signal.repeat_stay_threshold': number;
  'analytics.buyer_signal.long_stay_nights': number;
}

// Catalogs — taxonomies (doc 04 §8)
export interface CatalogEntry {
  key: string;
  icon?: string;
}

export interface CatalogConfig {
  'catalog.amenities': CatalogEntry[];
  'catalog.service_categories': CatalogEntry[];
  'catalog.ticket_categories': CatalogEntry[];
  'catalog.unit_types': CatalogEntry[];
  'catalog.cancellation_policies': CatalogEntry[];
}

// Union of all config types
export type AllConfig = BookingConfig &
  EngagementConfig &
  PricingConfig &
  CancellationConfig &
  ServicesConfig &
  OtherConfig &
  CatalogConfig;

export type ConfigKey = keyof AllConfig;
