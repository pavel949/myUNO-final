// module: audit — public interface
// Owns: AuditLog persistence and queries
// Used by: admin panel, privileged actions requiring audit trails

export {
  logAudit,
  getAuditLogForEntity,
  getRecentAuditLog,
  getAuditLogByActor,
} from './audit';

export {
  queryAuditLog,
  getAuditFacets,
  dayRangeToUtc,
  actionArea,
  AUDIT_PAGE_SIZE_DEFAULT,
  AUDIT_PAGE_SIZE_MAX,
  SYSTEM_ACTOR,
  THAI_UTC_OFFSET_MINUTES,
} from './audit-query';
export type {
  AuditLogFilter,
  AuditLogEntry,
  AuditLogPage,
  AuditFacet,
  AuditFacets,
} from './audit-query';
