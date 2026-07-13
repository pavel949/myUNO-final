// module: audit — public interface
// Owns: AuditLog persistence and queries
// Used by: admin panel, privileged actions requiring audit trails

export {
  logAudit,
  getAuditLogForEntity,
  getRecentAuditLog,
  getAuditLogByActor,
} from './audit';
