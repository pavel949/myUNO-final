import { permanentRedirect } from 'next/navigation';

/**
 * The reconciliation board moved into the `(admin)` route group so it renders
 * with the admin sidebar (board 03). This stub keeps the old address working
 * for anyone who bookmarked it before the move.
 */
export default function LegacyReconciliationPage(): never {
  permanentRedirect('/app/admin/reconciliation');
}
