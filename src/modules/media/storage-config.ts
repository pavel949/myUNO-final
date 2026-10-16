/** Shared server-upload credential selection. Presence is not provider health. */
export type MediaStorageCredentials =
  | { mode: 'token'; token: string }
  | { mode: 'oidc'; oidcToken: string; storeId: string };

export function mediaStorageCredentials(
  env: Readonly<Record<string, string | undefined>> = process.env
): MediaStorageCredentials | null {
  const token = env.BLOB_READ_WRITE_TOKEN?.trim();
  if (token) return { mode: 'token', token };
  const oidcToken = env.VERCEL_OIDC_TOKEN?.trim();
  const storeId = env.BLOB_STORE_ID?.trim();
  if (!oidcToken || !storeId || !/^(?:store_)?[A-Za-z0-9]{1,64}$/.test(storeId)) return null;
  return { mode: 'oidc', oidcToken, storeId };
}
