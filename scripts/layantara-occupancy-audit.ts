/**
 * Strict read-only import preflight over operator-exported snapshots.
 * Usage: npx tsx scripts/layantara-occupancy-audit.ts source.json crosswalk.json
 * Never connects to production or writes database records.
 */
import { readFileSync } from 'node:fs';
import { auditLegacyOccupancies } from '@/modules/integrations/layantara/adapter';
import type { LegacyOccupancy } from '../src/modules/integrations/layantara/adapter';

type Mapping = { sourceInventoryId: string; canonicalUnitId: string; identityVerified: boolean };
function parseFile(path: string): unknown { return JSON.parse(readFileSync(path, 'utf8')) as unknown; }
function main(): void {
  const [sourcePath, mappingPath] = process.argv.slice(2);
  if (!sourcePath || !mappingPath) throw new Error('Provide source.json and crosswalk.json');
  const source = parseFile(sourcePath);
  const crosswalk = parseFile(mappingPath);
  if (!Array.isArray(source) || !Array.isArray(crosswalk)) throw new Error('Both inputs must be JSON arrays');
  const rows: LegacyOccupancy[] = source.map((item: unknown) => {
    if (typeof item !== 'object' || item===null || Array.isArray(item)) throw new Error('Invalid occupancy record');
    const row = item as Record<string, unknown>;
    for (const key of ['id', 'inventory_id', 'occupancy_kind', 'state', 'check_in', 'check_out']) {
      if (typeof row[key] !== 'string') throw new Error('Source row missing '+key);
    }
    return row as unknown as LegacyOccupancy;
  });
  const mapping = new Map<string, string>();
  const targets = new Set<string>();
  for (const item of crosswalk as Mapping[]) {
    if (!item || typeof item.sourceInventoryId!=='string' || typeof item.canonicalUnitId!=='string' || typeof item.identityVerified!=='boolean') {
      throw new Error('Invalid crosswalk record');
    }
    if (!item.identityVerified) continue;
    if (mapping.has(item.sourceInventoryId) || targets.has(item.canonicalUnitId)) throw new Error('Duplicate verified unit mapping');
    mapping.set(item.sourceInventoryId,item.canonicalUnitId);
    targets.add(item.canonicalUnitId);
  }
  const report=auditLegacyOccupancies(rows,mapping);
  // No guest names, payment evidence or other personal data are emitted.
  console.log(JSON.stringify({
    sourceRecords: rows.length,
    verifiedPhysicalMappings: mapping.size,
    protect: report.protected,
    archive: report.archived,
    quarantine: report.quarantined,
    conflicts: report.conflicts,
    quarantineReasons: report.decisions.filter((x)=>x.action==='quarantine').reduce<Record<string,number>>((counts,row)=>{
      counts[row.reason]=(counts[row.reason]||0)+1;
      return counts;
    },{}),
  },null,2));
  if (report.quarantined || report.conflicts.length) process.exitCode=1;
}
try { main(); } catch (error) {
  console.error(error instanceof Error ? error.message : 'Audit failed');
  process.exitCode=1;
}
