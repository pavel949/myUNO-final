import { permanentRedirect } from 'next/navigation';

/**
 * The reconciliation board moved into the `(admin)` route group so it renders
 * inside the admin shell — outside it, the page came up with no sidebar and no
 * way back, which is why the canvas (board 03) puts it under Money & record.
 *
 * The old path stays as a permanent redirect rather than a deletion: it is the
 * URL anyone who has used this board has bookmarked, and a finance screen that
 * 404s during a month-end close is a worse failure than a stale link.
 */
export default function ReconciliationMoved(): never {
  permanentRedirect('/app/admin/reconciliation');
}
