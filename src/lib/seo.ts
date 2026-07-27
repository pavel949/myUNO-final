/**
 * SEO helpers (doc 08 §7). The canonical site origin comes from
 * NEXTAUTH_URL — the same base the auth emails and checkout links use —
 * so every environment (local, preview, production) stays consistent.
 */
export function siteUrl(): string {
  return (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
}
