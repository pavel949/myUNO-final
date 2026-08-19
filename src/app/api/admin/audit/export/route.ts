import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import { prisma } from '@/lib/prisma';
import { logAudit, queryAuditLog, AUDIT_PAGE_SIZE_MAX } from '@/modules/audit';
import { toCsv } from '@/lib/csv';

/**
 * Export the filtered audit trail as CSV — doc 12 §6's monthly compliance
 * report, produced from the platform rather than from a database client.
 *
 * **This export is itself audited.** Browsing the trail on screen is not: an
 * entry for every page view would bury the actions that matter under the act of
 * looking at them. An export is different — it is the moment the trail leaves
 * the platform and lands in a file somebody can forward, so who took it, when,
 * and with which filters is exactly what a regulator would ask.
 */

const EXPORT_ROW_LIMIT = 10_000;

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const identity = await prisma.identity.findUnique({ where: { id: user.identityId } });
  if (!identity) return NextResponse.json({ error: 'Identity not found' }, { status: 404 });

  if (
    !(await can({
      identity,
      action: 'admin:view_audit_log',
      resource: { resourceType: 'platform' },
    }))
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const filter = {
    actor: params.get('actor'),
    action: params.get('action'),
    entityType: params.get('entityType'),
    entityId: params.get('entityId'),
    from: params.get('from'),
    to: params.get('to'),
  };

  // Paged rather than one unbounded read: an audit table only grows, and a
  // single findMany over it would eventually take the process down.
  const rows: (string | null)[][] = [
    ['at_utc', 'action', 'entity_type', 'entity_id', 'actor_identity_id', 'actor_name', 'data'],
  ];
  let page = 1;
  let truncated = false;

  for (;;) {
    const result = await queryAuditLog(prisma, {
      ...filter,
      page,
      pageSize: AUDIT_PAGE_SIZE_MAX,
    });

    for (const entry of result.entries) {
      rows.push([
        // UTC in the file, Phuket time on the screen: a file gets read by
        // people and tools in other places, and an unqualified local timestamp
        // is the one thing an audit record must never be.
        entry.at.toISOString(),
        entry.action,
        entry.entityType,
        entry.entityId,
        entry.actorIdentityId,
        entry.actorName,
        entry.data === null || entry.data === undefined ? '' : JSON.stringify(entry.data),
      ]);
    }

    if (rows.length - 1 >= EXPORT_ROW_LIMIT) {
      truncated = result.total > rows.length - 1;
      break;
    }
    if (page >= result.pageCount) break;
    page += 1;
  }

  await logAudit({
    actorIdentityId: user.identityId,
    action: 'audit:export',
    entityType: 'AuditLog',
    entityId: 'export',
    // The filters, so the export can be reproduced exactly; no row content.
    data: { ...filter, rows: rows.length - 1, truncated },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(toCsv(rows), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="audit-log-${stamp}.csv"`,
      // A compliance export must never be served from a shared cache.
      'Cache-Control': 'no-store',
    },
  });
}
