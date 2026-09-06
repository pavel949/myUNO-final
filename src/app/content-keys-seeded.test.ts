import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every content key a surface asks for must exist in the content seed.
 *
 * `getLabels()` takes a map of content key → English draft, and falls back to
 * that draft when the key is missing from the database. That fallback is
 * deliberate — a page must stay legible when the database is unreachable — but
 * it also means a key that was never seeded is completely silent: the page
 * renders in English, forever, in every locale, and nothing fails. A Russian
 * guest simply sees English and no one finds out.
 *
 * That is exactly what happened to the four owner-statement breadcrumbs. This
 * test is the structural guard, in the same spirit as `reachability.test.ts`:
 * it reads the sources rather than rendering them, because "this key was never
 * seeded" is not a property any component test can see.
 */

const SRC_ROOT = join(process.cwd(), 'src');
const SEED_DIR = join(SRC_ROOT, 'modules/content');

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) found.push(path);
  }
  return found;
}

/** Every `key: '...'` declared across the seed files. */
function seededKeys(): Set<string> {
  const keys = new Set<string>();
  for (const entry of readdirSync(SEED_DIR)) {
    if (!/\.seed\.ts$|^seed\.ts$/.test(entry)) continue;
    const source = readFileSync(join(SEED_DIR, entry), 'utf8');
    for (const match of source.matchAll(/\bkey:\s*'([^']+)'/g)) keys.add(match[1]);
  }
  return keys;
}

/**
 * The keys passed to each `getLabels({ ... })` call in a file.
 *
 * Brace-matched from the call site rather than regexed line-by-line, so a
 * literal that merely looks like a key elsewhere in the file is not collected.
 */
function requestedKeys(source: string): string[] {
  const keys: string[] = [];
  for (const call of source.matchAll(/getLabels\s*\(\s*\{/g)) {
    let depth = 1;
    let i = call.index! + call[0].length;
    const start = i;
    while (i < source.length && depth > 0) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') depth--;
      i++;
    }
    const body = source.slice(start, i - 1);
    for (const entry of body.matchAll(/'([a-z][a-z0-9_]*(?:[.-][a-z0-9_]+)+)'\s*:/g)) {
      keys.push(entry[1]);
    }
  }
  return keys;
}


/**
 * Keys that are requested but not yet seeded, as of 2026-09-06.
 *
 * Every entry here is a string that renders its English draft in Russian and
 * Thai, silently, in production. They are listed rather than hidden so the
 * guard below can protect all *new* code immediately while this backlog is
 * worked down — the same arrangement `reachability.test.ts` uses for
 * `API_DEBT`. Delete each key from this list as it is seeded; the companion
 * test fails if a listed key turns out to be seeded after all, so the list
 * cannot go stale in either direction.
 *
 * Worked guest-facing-first: the clientele is Russian-speaking, so `booking`,
 * `services`, `owner` and `messages` cost more than `admin`. Those are done —
 * what remains is `admin`, which is internal and staffed by people who read
 * English, and so is the cheapest part of this backlog to still owe.
 */
const CONTENT_SEED_DEBT = new Set([
  // admin (274)
  'admin.attribution.col_buyers',
  'admin.attribution.col_category',
  'admin.attribution.col_channel',
  'admin.attribution.col_conv_buyer',
  'admin.attribution.col_conv_guest',
  'admin.attribution.col_conv_owner',
  'admin.attribution.col_guests',
  'admin.attribution.col_owners',
  'admin.attribution.col_profiles',
  'admin.attribution.empty',
  'admin.attribution.error',
  'admin.attribution.loading',
  'admin.attribution.subtitle',
  'admin.attribution.summary_channels',
  'admin.attribution.summary_profiles',
  'admin.bookings.approve',
  'admin.bookings.cancel',
  'admin.bookings.cancel_confirm',
  'admin.bookings.decline',
  'admin.bookings.empty',
  'admin.bookings.error_generic',
  'admin.bookings.load_more',
  'admin.bookings.loading',
  'admin.bookings.paid',
  'admin.bookings.receipt_placeholder',
  'admin.bookings.record_cash',
  'admin.bookings.showing',
  'admin.bookings.title',
  'admin.checklists.col_action',
  'admin.checklists.col_due',
  'admin.checklists.col_result',
  'admin.checklists.col_template',
  'admin.checklists.col_unit',
  'admin.checklists.create_submit',
  'admin.checklists.create_template',
  'admin.checklists.default_item',
  'admin.checklists.empty',
  'admin.checklists.error',
  'admin.checklists.failed',
  'admin.checklists.freq.annual',
  'admin.checklists.freq.monthly',
  'admin.checklists.freq.quarterly',
  'admin.checklists.freq.weekly',
  'admin.checklists.loading',
  'admin.checklists.mark_fail',
  'admin.checklists.mark_pass',
  'admin.checklists.passed',
  'admin.checklists.pending',
  'admin.checklists.schedule_submit',
  'admin.checklists.schedule_title',
  'admin.checklists.select_template',
  'admin.checklists.select_unit',
  'admin.checklists.subtitle',
  'admin.checklists.template_name',
  'admin.config.history_empty',
  'admin.config.history_error',
  'admin.config.history_hide',
  'admin.config.history_loading',
  'admin.content.error_generic',
  'admin.content.export_error',
  'admin.content.import_error',
  'admin.content.import_success',
  'admin.content.loading',
  'admin.content.needs_review',
  'admin.content.save',
  'admin.content.saved',
  'admin.content.title',
  'admin.contracts.basis.fixed',
  'admin.contracts.basis.percentage_gop',
  'admin.contracts.basis.percentage_gross_booking',
  'admin.contracts.basis.percentage_noi',
  'admin.contracts.calculate_submit',
  'admin.contracts.calculate_title',
  'admin.contracts.close',
  'admin.contracts.col_action',
  'admin.contracts.col_basis',
  'admin.contracts.col_owner',
  'admin.contracts.col_period',
  'admin.contracts.col_project',
  'admin.contracts.col_status',
  'admin.contracts.col_unit',
  'admin.contracts.create_submit',
  'admin.contracts.create_title',
  'admin.contracts.empty',
  'admin.contracts.error',
  'admin.contracts.fees_col_amount',
  'admin.contracts.fees_col_basis',
  'admin.contracts.fees_col_period',
  'admin.contracts.fees_col_status',
  'admin.contracts.fees_col_type',
  'admin.contracts.fees_empty',
  'admin.contracts.fees_title',
  'admin.contracts.field_basis',
  'admin.contracts.field_end',
  'admin.contracts.field_fixed',
  'admin.contracts.field_gop',
  'admin.contracts.field_gross',
  'admin.contracts.field_noi',
  'admin.contracts.field_owner',
  'admin.contracts.field_period_end',
  'admin.contracts.field_period_start',
  'admin.contracts.field_project',
  'admin.contracts.field_rate',
  'admin.contracts.field_start',
  'admin.contracts.field_unit',
  'admin.contracts.loading',
  'admin.contracts.performance_baseline',
  'admin.contracts.performance_enable',
  'admin.contracts.performance_rate',
  'admin.contracts.status.active',
  'admin.contracts.status.expired',
  'admin.contracts.status.pending_signature',
  'admin.contracts.status.terminated',
  'admin.contracts.subtitle',
  'admin.contracts.view_fees',
  'admin.crm.activity.body',
  'admin.crm.activity.error',
  'admin.crm.activity.saving',
  'admin.crm.activity.subject',
  'admin.crm.activity.submit',
  'admin.crm.contact',
  'admin.crm.create',
  'admin.crm.empty',
  'admin.crm.error',
  'admin.crm.lifecycle.col_action',
  'admin.crm.lifecycle.col_email',
  'admin.crm.lifecycle.col_score',
  'admin.crm.lifecycle.col_value',
  'admin.crm.lifecycle.error',
  'admin.crm.lifecycle.loading',
  'admin.crm.lifecycle.move_to',
  'admin.crm.lifecycle.reason_prompt',
  'admin.crm.lifecycle.stage.buyer',
  'admin.crm.lifecycle.stage.contact',
  'admin.crm.lifecycle.stage.former_client',
  'admin.crm.lifecycle.stage.guest',
  'admin.crm.lifecycle.stage.investor',
  'admin.crm.lifecycle.stage.managed',
  'admin.crm.lifecycle.stage.owner',
  'admin.crm.lifecycle.stage.prospect',
  'admin.crm.lifecycle.stage.repeat',
  'admin.crm.lifecycle.stage.seller',
  'admin.crm.lifecycle.subtitle',
  'admin.crm.lost_reason',
  'admin.crm.new',
  'admin.crm.next_action',
  'admin.crm.next_action_overdue',
  'admin.crm.opportunities.back_link',
  'admin.crm.opportunities.breadcrumb_admin',
  'admin.crm.opportunities.breadcrumb_crm',
  'admin.crm.opportunities.breadcrumb_detail',
  'admin.crm.opportunities.breadcrumb_home',
  'admin.crm.opportunities.details_heading',
  'admin.crm.opportunity_title',
  'admin.crm.partner',
  'admin.crm.pipeline_breakdown',
  'admin.crm.source',
  'admin.crm.stage.discovery',
  'admin.crm.stage.lost',
  'admin.crm.stage.negotiation',
  'admin.crm.stage.new',
  'admin.crm.stage.nurture',
  'admin.crm.stage.proposal',
  'admin.crm.stage.qualified',
  'admin.crm.stage.won',
  'admin.crm.subtitle',
  'admin.crm.title',
  'admin.crm.type',
  'admin.crm.type.capex',
  'admin.crm.type.compliance',
  'admin.crm.type.developer_advisory',
  'admin.crm.type.management',
  'admin.crm.type.purchase',
  'admin.crm.type.rental',
  'admin.crm.type.sale',
  'admin.crm.value',
  'admin.dashboard.bookings',
  'admin.dashboard.people',
  'admin.dashboard.tickets',
  'admin.dashboard.title',
  'admin.dashboard.units',
  'admin.incidents.col_action',
  'admin.kpis.col_actual',
  'admin.kpis.col_metric',
  'admin.kpis.col_period',
  'admin.kpis.col_period_end',
  'admin.kpis.col_period_start',
  'admin.kpis.col_status',
  'admin.kpis.col_target',
  'admin.kpis.col_unit',
  'admin.kpis.create_submit',
  'admin.kpis.create_title',
  'admin.kpis.empty',
  'admin.kpis.error',
  'admin.kpis.filter_all',
  'admin.kpis.filter_at_risk',
  'admin.kpis.filter_below',
  'admin.kpis.filter_on_track',
  'admin.kpis.loading',
  'admin.kpis.select_unit',
  'admin.kpis.status.at_risk',
  'admin.kpis.status.below_target',
  'admin.kpis.status.on_track',
  'admin.ledger.amount',
  'admin.ledger.created_by',
  'admin.ledger.date',
  'admin.ledger.description',
  'admin.ledger.empty',
  'admin.ledger.error_generic',
  'admin.ledger.no_projects',
  'admin.ledger.project',
  'admin.ledger.reverse',
  'admin.ledger.subtitle',
  'admin.ledger.title',
  'admin.ledger.totals',
  'admin.ledger.type',
  'admin.ledger.unit',
  'admin.nav.bookings',
  'admin.organizations.col_action',
  'admin.prospecting.action.closed',
  'admin.prospecting.action.contacted',
  'admin.prospecting.action.interested',
  'admin.prospecting.action.pitched',
  'admin.prospecting.col_action',
  'admin.prospecting.col_close',
  'admin.prospecting.col_contact',
  'admin.prospecting.col_reason',
  'admin.prospecting.col_status',
  'admin.prospecting.col_type',
  'admin.prospecting.create_submit',
  'admin.prospecting.create_title',
  'admin.prospecting.empty',
  'admin.prospecting.error',
  'admin.prospecting.filter_active',
  'admin.prospecting.filter_closed',
  'admin.prospecting.filter_contacted',
  'admin.prospecting.filter_interested',
  'admin.prospecting.filter_new',
  'admin.prospecting.loading',
  'admin.prospecting.select_contact',
  'admin.prospecting.status.closed',
  'admin.prospecting.status.contacted',
  'admin.prospecting.status.interested',
  'admin.prospecting.status.new',
  'admin.prospecting.status.pitched',
  'admin.prospecting.type.developer',
  'admin.prospecting.type.institutional_partner',
  'admin.prospecting.type.owner',
  'admin.service_orders.col_action',
  'admin.statements.hide_lines',
  'admin.statements.lines_amount',
  'admin.statements.lines_category',
  'admin.statements.lines_description',
  'admin.statements.lines_empty',
  'admin.statements.lines_loading',
  'admin.statements.view_lines',
  'admin.units.asset_status.one_off_sourced',
  'admin.units.asset_status.verified_partner',
  'admin.units.asset_status_reason',
  'admin.units.breadcrumb_admin',
  'admin.units.breadcrumb_detail',
  'admin.units.breadcrumb_home',
  'admin.units.breadcrumb_units',
  'admin.units.confirm_action',
  'admin.units.confirmed',
  'admin.units.error_generic',
  'admin.units.owner',
  'admin.units.pause',
  'admin.units.permitted_use',
  'admin.units.price',
  'admin.units.set_live',
  'admin.units.status',
  'admin.units.title',
  'admin.units.upload_photo',
]);

const seeded = seededKeys();

describe('content keys are seeded', () => {
  it('has more than a token number of seeded keys (the parser still works)', () => {
    // Guards the test itself: a seed-file rename that broke the scan would
    // otherwise make this suite pass by finding nothing to check.
    expect(seeded.size).toBeGreaterThan(1000);
  });

  it('every key a surface asks getLabels() for exists in the seed', () => {
    const missing: string[] = [];
    for (const path of sourceFiles(SRC_ROOT)) {
      const source = readFileSync(path, 'utf8');
      if (!source.includes('getLabels')) continue;
      for (const key of requestedKeys(source)) {
        if (seeded.has(key) || CONTENT_SEED_DEBT.has(key)) continue;
        missing.push(`${key}  (${path.slice(process.cwd().length + 1)})`);
      }
    }

    expect(
      [...new Set(missing)].sort(),
      'these content keys are requested by a surface but never seeded — they would render their English draft in every locale, silently. Add them to the content seed as needs_review drafts (doc 05 §1)'
    ).toEqual([]);
  });

  it('does not let CONTENT_SEED_DEBT quietly collect keys that got seeded since', () => {
    const stillMissing = [...CONTENT_SEED_DEBT].filter((key) => !seeded.has(key));

    expect(
      stillMissing.length,
      'every CONTENT_SEED_DEBT entry should still be genuinely unseeded — remove any that a later commit seeded'
    ).toBe(CONTENT_SEED_DEBT.size);
  });
});
