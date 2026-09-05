import { redirect } from 'next/navigation';

/**
 * Moved to /app/admin/finance/reconciliation (CURSOR_PROMPT phase 2) so it
 * renders inside the admin shell with its sidebar instead of bare. This
 * stub only preserves anyone's existing bookmark or link to the old path.
 */
export default function ReconciliationRedirectPage() {
  redirect('/app/admin/finance/reconciliation');
}
