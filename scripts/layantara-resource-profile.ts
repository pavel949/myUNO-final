/**
 * STATIC RESOURCE PROFILE ONLY. Never reads bookings, occupancy, payments,
 * guest/staff lists, operational events, historical pricing_change_log or PII.
 * Run with READ-ONLY DB credentials against the private staged snapshot.
 * Output is a data file; no target DB writes and no booking/cutover side effect.
 *
 * npx tsx scripts/layantara-resource-profile.ts /tmp/layantara-resource.json
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

export const RESOURCE_FIELDS: Record<string, readonly string[]> = {
  "projects": ["id","name","location","timezone","project_type"],
  "project_public_profile": ["id","project_id","name","address","location","short_description","long_description","amenities","facilities","latitude","longitude"],
  "villa_categories": ["id","project_id","code","name","bedrooms","max_adults","max_children","max_guests","booking_mode","positioning"],
  "operational_inventory": ["id","project_id","unit_code","category_id","bedrooms","bathrooms","internal_area_sqm","external_area_sqm","total_building_area_sqm","plot_area_sqm","view_type","bed_configuration","amenities","equipment","features","public_name","public_description","phase"],
  "villa_master_crosswalk": ["id","project_id","inventory_id","villa_id","unit_code","category_id","operational_verification_status","category_verification_status","specification_verification_status"],
  "villa_category_content": ["id","project_id","category_id","product_key","locale","title","description","published"],
  "villa_media": ["id","project_id","inventory_id","media_type","storage_path","mime_type","alt_text","caption","width","height","byte_size","sort_order","is_cover","published"],
  "rate_plans": ["id","project_id","code","name","min_nights","meal_plan","cancellation_policy","active"],
  "rate_seasons": ["id","project_id","code","name","rate_mode","date_windows","min_nights","min_nights_status","active"],
  "category_rates": ["id","project_id","category_id","season_id","amount","currency","pricing_unit","includes_taxes","includes_service_charge","includes_breakfast","agent_commission_note","source_date","source_document","active","is_sellable","rate_set_id","source_label"],
  "channel_product_rates": ["id","project_id","structure_id","product_code","season_code","amount","pricing_unit"],
  "channel_rate_structures": ["id","project_id","code","name","currency","booking_rule","channel_scope","early_booking_days","min_units","source_document","source_note","active"],
  "inventory_product_configurations": ["id","project_id","inventory_id","product_code","product_family","product_name","sellable_bedrooms","source_document","source_note","active"],
  "pricing_rate_sets": ["id","project_id","name","effective_from","effective_to","source_document","status","version","approved_at"],
  "pricing_charge_rules": ["id","project_id","code","label","amount","currency","included","rate_mode","sort_order","unit_label","active"],
  "pricing_discount_rules": ["id","project_id","name","discount_percent","max_nights","min_nights","priority","rate_mode","source_text","stackable","active"],
  "pricing_distribution_schemes": ["id","project_id","name","rate_mode","active"],
  "pricing_distribution_components": ["id","scheme_id","beneficiary_code","calculation_type","display_name","sequence","value","active"],
  "pricing_engine_settings": ["id","project_id","setting_key","setting_value","description"],
  "project_commercial_policies": ["id","project_id","policy_code","policy_data","source_date","source_document","active"],
  "booking_condition_rules": ["id","project_id","name","scope_type","category_id","inventory_id","season_code","stay_start","stay_end","min_nights","payment_percent_to_confirm","balance_timing","cancellation_summary","security_deposit_thb","included","excluded","stay_terms","priority","active","rate_mode","security_deposit_usd","confirmation_payment_type","confirmation_payment_value","security_deposit_type","security_deposit_multiplier","amendments_allowed"],
};
const PROVENANCE_FIELDS = new Set(['created_at','updated_at','created_by','updated_by']);
const FORBIDDEN = /^(guest|guest_id|guest_name|email|phone|passport|booking_id|reservation_id|payment_id|receipt_id|transaction_id|owner_statement_id|amount_paid|balance|account_number|bank_account|session_id|access_token|refresh_token|audit_log)$/i;
const MIN_COUNTS: Record<string, number> = {
  projects: 1, villa_categories: 8, operational_inventory: 39,
  villa_master_crosswalk: 39, villa_category_content: 24, category_rates: 72,
  villa_media: 67,
};
const TARIFF_TABLES = new Set(Object.keys(RESOURCE_FIELDS).filter(k =>
  /^(rate_|category_rates|channel_|inventory_product_configurations|pricing_|project_commercial_policies|booking_condition_rules)/.test(k)
));

function rejectOperationalKeys(value: unknown, path = 'resource'): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectOperationalKeys(item, `${path}[${index}]`));
  } else if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN.test(key)) throw new Error(`Operational data in static profile: ${path}.${key}`);
      rejectOperationalKeys(child, `${path}.${key}`);
    }
  }
}

export function sanitizeResourceRow(table: string, payload: Record<string, unknown>) {
  const fields = RESOURCE_FIELDS[table];
  if (!fields) throw new Error('Source table is not allowed in the resource profile');
  if (TARIFF_TABLES.has(table)) {
    const unknown = Object.keys(payload).filter(key => !fields.includes(key) && !PROVENANCE_FIELDS.has(key));
    if (unknown.length) throw new Error(`Unmapped tariff fields in ${table}: ${unknown.join(',')}`);
  }
  const sanitized: Record<string, unknown> = {};
  for (const field of fields) {
    if (FORBIDDEN.test(field)) throw new Error(`Forbidden resource field: ${field}`);
    if (Object.prototype.hasOwnProperty.call(payload,field)) sanitized[field]=payload[field];
  }
  rejectOperationalKeys(sanitized);
  if (!sanitized.id) throw new Error(`Missing stable source identity in ${table}`);
  return sanitized;
}

function sha(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
async function main() {
  const dest=process.argv[2];
  if (!dest || !dest.startsWith('/')) throw new Error('Specify an explicit absolute output file path');
  const db=new PrismaClient();
  try {
    const tables=Object.keys(RESOURCE_FIELDS);
    const rows=await db.$queryRaw<Array<{source_table:string;source_id:string;payload:Record<string,unknown>}>>`
      SELECT source_table,source_id,payload
      FROM layantara_copy.source_row
      WHERE source_table IN (${Prisma.join(tables)})
      ORDER BY source_table,source_id
    `;
    const counts:Record<string,number>={};
    const collections:Record<string,unknown[]>={};
    for(const row of rows) {
      const data=sanitizeResourceRow(row.source_table,row.payload);
      (collections[row.source_table] ||= []).push({ source_id:row.source_id, data, sha256:sha(data) });
      counts[row.source_table]=(counts[row.source_table]||0)+1;
    }
    for(const [table,min] of Object.entries(MIN_COUNTS)) {
      if(counts[table]!==min) throw new Error(`Expected ${min} verified ${table}; got ${counts[table]||0}`);
    }
    const audits=await db.$queryRaw<Array<{source_table:string;source_count:number;copied_count:number;verified:boolean;source_checksum:string;target_checksum:string}>>`
      SELECT source_table,source_count,copied_count,verified,source_checksum,target_checksum
      FROM layantara_copy.import_audit WHERE source_table IN (${Prisma.join(tables)})
    `;
    for (const table of tables) {
      const audit=audits.find(a=>a.source_table===table);
      if (!audit || !audit.verified || audit.source_count!==audit.copied_count ||
          audit.source_checksum!==audit.target_checksum || audit.copied_count!==(counts[table]||0)) {
        throw new Error(`Unverified or changed source snapshot: ${table}`);
      }
    }
    const body={ schema:'myuno.static-resource-profile.v1',source:'layantara_os',
      scope:'definitions_only',activation:'draft',counts,collections,
      excluded:['bookings','reservations','occupancy','blocks','holds','guests','staff_lists',
        'payments','refunds','ledger','owner_statements','tasks','notifications','pricing_change_log'],
      tariffParity:'requires_source_engine_golden_master',
    };
    await writeFile(dest,JSON.stringify({...body,manifestSha256:sha(body)},null,2),{flag:'wx',mode:0o600});
    console.log(JSON.stringify({file:dest,counts,scope:body.scope,tariffParity:body.tariffParity}));
  } finally {await db.$disconnect();}
}
if(process.argv[1]?.endsWith('layantara-resource-profile.ts')) main().catch(e=>{
  console.error(e instanceof Error?e.message:'Resource export failed'); process.exitCode=1;
});
