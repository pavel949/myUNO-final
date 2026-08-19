import { PrismaClient, Prisma } from '@prisma/client';

/**
 * Reading the audit trail.
 *
 * Every privileged action has written an `AuditLog` row since the first loop —
 * role grants, config changes, PII reads, statement publication, retention
 * purges — and **nothing has ever read one back**. CLAUDE.md promises a
 * monthly audit report for compliance review (doc 12 §6); a trail nobody can
 * open is a promise that cannot be kept and, worse, cannot be seen to be
 * broken.
 *
 * The write side is deliberately best-effort (a role grant must not fail
 * because the trail could not be written). The read side is the opposite: it
 * must be exact, stable under paging, and cheap enough to run over a table
 * that only ever grows.
 */

export const AUDIT_PAGE_SIZE_DEFAULT = 50;
export const AUDIT_PAGE_SIZE_MAX = 200;

/**
 * Thailand has never observed daylight saving time, so a fixed +07:00 is exact
 * rather than an approximation — a date-only filter means the same thing in
 * January and in July. Timestamps are stored in UTC; the operator thinks in
 * Phuket time, and the two must not silently differ by seven hours at the
 * boundaries of a day.
 */
export const THAI_UTC_OFFSET_MINUTES = 7 * 60;

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Turn two `YYYY-MM-DD` strings, read as Phuket days, into a UTC half-open
 * range `[gte, lt)`.
 *
 * The upper bound is exclusive and lands at midnight *after* the chosen day, so
 * "to 19 August" includes everything that happened on 19 August. An inclusive
 * `lte` on the date itself would silently drop a whole day of entries — the
 * kind of quiet omission an audit trail exists to prevent.
 *
 * A malformed value narrows nothing rather than throwing: a hand-edited URL
 * should show more than expected, never a 500 in the middle of an audit.
 */
export function dayRangeToUtc(
  from?: string | null,
  to?: string | null
): { gte?: Date; lt?: Date } {
  const range: { gte?: Date; lt?: Date } = {};
  const startOfDayUtc = (value: string): number | null => {
    const match = DATE_ONLY.exec(value);
    if (!match) return null;
    const [, year, month, day] = match;
    const ms = Date.UTC(Number(year), Number(month) - 1, Number(day));
    // Reject 2026-02-31 and friends: Date.UTC rolls them over silently.
    const rolled = new Date(ms);
    if (rolled.getUTCMonth() !== Number(month) - 1 || rolled.getUTCDate() !== Number(day)) {
      return null;
    }
    return ms - THAI_UTC_OFFSET_MINUTES * 60 * 1000;
  };

  if (from) {
    const start = startOfDayUtc(from);
    if (start !== null) range.gte = new Date(start);
  }
  if (to) {
    const start = startOfDayUtc(to);
    if (start !== null) range.lt = new Date(start + DAY_MS);
  }
  return range;
}

/** The sentinel an actor filter uses for entries no person caused. */
export const SYSTEM_ACTOR = 'system';

export interface AuditLogFilter {
  /** An identity id, or `system` for scheduled jobs and other actorless entries. */
  actor?: string | null;
  /**
   * An exact action (`roles:grant`), or an area ending in a colon (`money:`)
   * to match every action in it.
   */
  action?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  /** Phuket days, inclusive of both ends. */
  from?: string | null;
  to?: string | null;
  page?: number;
  pageSize?: number;
}

export interface AuditLogEntry {
  id: string;
  at: Date;
  action: string;
  entityType: string;
  entityId: string;
  actorIdentityId: string | null;
  actorName: string | null;
  data: Prisma.JsonValue | null;
}

export interface AuditLogPage {
  entries: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

function buildWhere(filter: AuditLogFilter): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};

  if (filter.actor === SYSTEM_ACTOR) {
    where.actorIdentityId = null;
  } else if (filter.actor) {
    where.actorIdentityId = filter.actor;
  }

  if (filter.action) {
    // Actions are namespaced `area:verb`. A trailing colon asks for the whole
    // area, which is how an auditor actually thinks — "show me the money".
    where.action = filter.action.endsWith(':')
      ? { startsWith: filter.action }
      : filter.action;
  }

  if (filter.entityType) where.entityType = filter.entityType;
  if (filter.entityId) where.entityId = filter.entityId;

  const range = dayRangeToUtc(filter.from, filter.to);
  if (range.gte || range.lt) where.at = range;

  return where;
}

/** Clamp so a hand-edited `?pageSize=100000` cannot ask for the whole table. */
function clampPaging(filter: AuditLogFilter) {
  const pageSize = Math.min(
    Math.max(1, Math.floor(filter.pageSize || AUDIT_PAGE_SIZE_DEFAULT)),
    AUDIT_PAGE_SIZE_MAX
  );
  const page = Math.max(1, Math.floor(filter.page || 1));
  return { page, pageSize };
}

/**
 * One page of the trail, newest first.
 *
 * The sort is `at desc, id desc`, not `at desc` alone. Several entries are
 * written in the same millisecond — a role grant and the config change behind
 * it — and with an unstable tie-break the same row can appear on two pages
 * while another appears on none. In an audit trail a silently skipped row is
 * the worst possible bug, so the id breaks every tie.
 */
export async function queryAuditLog(
  db: PrismaClient,
  filter: AuditLogFilter = {}
): Promise<AuditLogPage> {
  const { page, pageSize } = clampPaging(filter);
  const where = buildWhere(filter);

  const [total, rows] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: [{ at: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        at: true,
        action: true,
        entityType: true,
        entityId: true,
        actorIdentityId: true,
        data: true,
        actor: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  return {
    entries: rows.map((row) => ({
      id: row.id,
      at: row.at,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      actorIdentityId: row.actorIdentityId,
      actorName: row.actor ? `${row.actor.firstName} ${row.actor.lastName}`.trim() : null,
      data: row.data as Prisma.JsonValue | null,
    })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export interface AuditFacet {
  value: string;
  count: number;
}

export interface AuditFacets {
  actions: AuditFacet[];
  entityTypes: AuditFacet[];
}

/**
 * What the filters can offer, derived from what is actually in the table.
 *
 * Deliberately not a hardcoded list: actions are added by whoever writes the
 * next `logAudit` call, and a fixed dropdown would quietly hide them. The
 * counts come free from the same grouping and tell an auditor where the volume
 * is before they filter.
 */
export async function getAuditFacets(db: PrismaClient): Promise<AuditFacets> {
  const [actions, entityTypes] = await Promise.all([
    db.auditLog.groupBy({ by: ['action'], _count: { _all: true } }),
    db.auditLog.groupBy({ by: ['entityType'], _count: { _all: true } }),
  ]);

  const toFacets = (rows: { _count: { _all: number } }[], key: 'action' | 'entityType') =>
    rows
      .map((row) => ({ value: (row as never as Record<string, string>)[key], count: row._count._all }))
      .sort((a, b) => a.value.localeCompare(b.value));

  return {
    actions: toFacets(actions, 'action'),
    entityTypes: toFacets(entityTypes, 'entityType'),
  };
}

/** The area an action belongs to — `roles:grant` → `roles`; unnamespaced → null. */
export function actionArea(action: string): string | null {
  const index = action.indexOf(':');
  return index > 0 ? action.slice(0, index) : null;
}
