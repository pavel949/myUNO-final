import { randomBytes } from 'node:crypto';
import { proposalShell } from '@/modules/sales-offers/public-shell';
/** Standalone document: no React admin shell, identity/session lookup, trackers or guest registry. */
export async function GET() {
  const nonce=randomBytes(18).toString('base64');
  return new Response(proposalShell(nonce),{headers:{
    'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store',
    'Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow, noarchive',
    'Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
  }});
}
