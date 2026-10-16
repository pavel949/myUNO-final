import { randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { authorizeContentTargetTx } from '@/modules/onboarding/content-proposal.service';
import {
  DIRECT_UPLOAD_RECOVERY_MS, DIRECT_UPLOAD_TTL_MS, canonicalPhotoUrl, matchesPhotoSignature,
  parseDirectUploadRequest, photoPath, signDirectUploadIntent, uploadFailure, verifyDirectUploadIntent,
  DirectUploadError, type DirectUploadIntent, type DirectUploadRequest,
} from './direct-upload.policy';

type BlobSdk = Pick<typeof import('@vercel/blob'), 'issueSignedToken' | 'presignUrl' | 'head' | 'BlobNotFoundError'>;
type BlobAuth = { token: string } | { storeId: string };
export type DirectUploadConfig = { secret: string; environment: string; storeId: string; auth: BlobAuth };
export type DirectUploadDependencies = {
  config?: () => DirectUploadConfig; sdk?: () => Promise<BlobSdk>; fetch?: typeof fetch; now?: () => number; uuid?: () => string;
};
const unavailable = (): never => uploadFailure(503, 'Direct image storage is unavailable.');
const mismatch = (): never => uploadFailure(409, 'Uploaded image does not match this request.');
const normalizeStore = (id: string) => id.startsWith('store_') ? id.slice(6) : id;

/** Read at request time, never at build time. No new credentials or insecure dev key. */
export function directUploadConfig(env: Readonly<Record<string, string | undefined>> = process.env): DirectUploadConfig {
  const secret = env.SESSION_SECRET || env.NEXTAUTH_SECRET;
  // Only the official SDK control endpoint is permitted for this upload protocol.
  if (!secret?.trim() || env.VERCEL_BLOB_API_URL || env.NEXT_PUBLIC_VERCEL_BLOB_API_URL) return unavailable();
  const deployment = env.VERCEL_URL?.toLowerCase();
  const vercelDeployment = env.VERCEL === '1' || Boolean(env.VERCEL_ENV || env.VERCEL_TARGET_ENV);
  if ((vercelDeployment && !deployment) || (deployment && (deployment.length > 253 ||
      !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(deployment)))) return unavailable();
  const token = env.BLOB_READ_WRITE_TOKEN;
  const configuredStore = env.BLOB_STORE_ID;
  // Same precedence as the existing media seam. Token parsing matches 2.8.0 helpers.ts.
  const storeId = token ? token.split('_')[3] : configuredStore ? normalizeStore(configuredStore) : '';
  if (!storeId || !/^[A-Za-z0-9]{1,64}$/.test(storeId)) return unavailable();
  const environment = JSON.stringify([env.NODE_ENV || 'development', env.VERCEL_ENV || 'local',
    env.VERCEL_TARGET_ENV || '', env.VERCEL_PROJECT_ID || '', deployment || 'local']);
  // With OIDC, the SDK refreshes the deployment credential itself. Do not capture
  // a possibly expired VERCEL_OIDC_TOKEN or expose it to the browser.
  // VERCEL_URL pins preview intents to their issuing deployment, including retries.
  return { secret, environment, storeId: storeId.toLowerCase(), auth: token ? { token } : { storeId } };
}
function validateDelegation(result: Awaited<ReturnType<BlobSdk['issueSignedToken']>>, config: DirectUploadConfig,
  pathname: string, input: Extract<DirectUploadRequest, { action: 'initiate' }>, issuedAt: number, requestedUntil: number): number {
  let scope: Record<string, unknown>;
  try { scope = JSON.parse(Buffer.from(result.delegationToken.split('.')[0], 'base64url').toString('utf8')); }
  catch { return unavailable(); }
  if (!scope || typeof scope !== 'object' || typeof scope.storeId !== 'string' || normalizeStore(scope.storeId).toLowerCase() !== config.storeId || scope.pathname !== pathname ||
      !Array.isArray(scope.operations) || scope.operations.length !== 1 || scope.operations[0] !== 'put' ||
      !Array.isArray(scope.allowedContentTypes) || scope.allowedContentTypes.length !== 1 || scope.allowedContentTypes[0] !== input.mimeType ||
      scope.maximumSizeInBytes !== input.sizeBytes || scope.validUntil !== result.validUntil ||
      !Number.isSafeInteger(result.validUntil) || result.validUntil <= issuedAt || result.validUntil > requestedUntil) return unavailable();
  return result.validUntil;
}
function assertPresignedDestination(url: string, pathname: string): void {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return unavailable(); }
  if (parsed.origin !== 'https://vercel.com' || parsed.pathname !== '/api/blob/' || parsed.username || parsed.password || parsed.hash ||
      parsed.searchParams.getAll('pathname').length !== 1 || parsed.searchParams.get('pathname') !== pathname) return unavailable();
}
function bindCurrent(intent: DirectUploadIntent, actorId: string, config: DirectUploadConfig): void {
  if (intent.ownerId !== actorId || intent.environment !== config.environment || intent.storeId !== config.storeId) {
    return uploadFailure(403, 'This upload request is not available to you.');
  }
}
async function serializable<T>(db: PrismaClient, run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { return await db.$transaction(run, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 15000 }); }
    catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
      // A uniqueness race also rolls back this transaction. Retry authorization
      // and compare the winner; never upsert or retry an unknown commit outcome.
      const meta = error && typeof error === 'object' && 'meta' in error ? error.meta : null;
      const databaseCode = meta && typeof meta === 'object' && 'code' in meta ? meta.code : null;
      if (code !== 'P2034' && code !== 'P2002' && !['40001', '40P01'].includes(String(databaseCode))) throw error;
      if (attempt === 2) return uploadFailure(409, 'Image registration changed. Retry confirmation.');
    }
  }
  return mismatch();
}
async function verifyPrefix(fetcher: typeof fetch, url: string, intent: DirectUploadIntent): Promise<void> {
  const wanted = Math.min(32, intent.sizeBytes);
  let response: Response;
  try {
    response = await fetcher(url, { method: 'GET', headers: { Range: `bytes=0-${wanted - 1}` },
      redirect: 'error', cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(10000) });
  } catch { return uploadFailure(502, 'Image verification could not finish. Retry confirmation.'); }
  const reader = response.body?.getReader();
  try {
    if (!reader || response.redirected || (response.url && response.url !== url) || ![200, 206].includes(response.status)) return mismatch();
    if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== intent.mimeType ||
        (response.headers.get('content-encoding') && response.headers.get('content-encoding') !== 'identity')) return mismatch();
    if (response.status === 206 && response.headers.get('content-range') !== `bytes 0-${wanted - 1}/${intent.sizeBytes}`) return mismatch();
    const length = response.headers.get('content-length');
    if (length !== null && length !== String(response.status === 206 ? wanted : intent.sizeBytes)) return mismatch();
    const bytes = new Uint8Array(wanted); let offset = 0;
    while (offset < wanted) {
      const part = await reader.read();
      if (part.done) break;
      const take = part.value.subarray(0, wanted - offset);
      bytes.set(take, offset); offset += take.length;
    }
    // Do not buffer the object even when Range is ignored. The reader is always
    // cancelled immediately after the fixed 32-byte prefix (or on any error).
    if (offset !== wanted || !matchesPhotoSignature(bytes, intent.mimeType)) return mismatch();
  } catch (error) {
    if (error instanceof DirectUploadError) throw error;
    return uploadFailure(502, 'Image verification could not finish. Retry confirmation.');
  } finally { await reader?.cancel().catch(() => undefined); }
}
const ASSET_SELECT = { id: true, storageKey: true, uploadedByIdentityId: true, kind: true,
  mimeType: true, sizeBytes: true, encrypted: true, deleteAfter: true } as const;

/** Public content photos only. Never attaches media, approves content or publishes. */
export function createDirectUploadService(db: PrismaClient, deps: DirectUploadDependencies = {}) {
  const configuration = deps.config ?? directUploadConfig;
  const loadSdk = deps.sdk ?? (() => import('@vercel/blob'));
  const now = deps.now ?? Date.now;
  const fetcher = deps.fetch ?? fetch;
  return {
    async execute(actorId: string, raw: unknown) {
      const input = parseDirectUploadRequest(raw);
      const configured = configuration();
      const config = { ...configured, storeId: normalizeStore(configured.storeId).toLowerCase() };
      if (input.action === 'initiate') {
        const target = await serializable(db, tx => authorizeContentTargetTx(tx, actorId, input.scope, input.targetId, true));
        const issuedAt = now(), requestedUntil = issuedAt + DIRECT_UPLOAD_TTL_MS;
        const pathname = photoPath((deps.uuid ?? randomUUID)(), input.mimeType);
        let uploadUrl: string, uploadUntil: number;
        try {
          const sdk = await loadSdk();
          const signed = await sdk.issueSignedToken({ ...config.auth, pathname, operations: ['put'], validUntil: requestedUntil,
            maximumSizeInBytes: input.sizeBytes, allowedContentTypes: [input.mimeType], abortSignal: AbortSignal.timeout(10000) });
          uploadUntil = validateDelegation(signed, config, pathname, input, issuedAt, requestedUntil);
          const result = await sdk.presignUrl(signed, { operation: 'put', access: 'public', pathname, validUntil: uploadUntil,
            maximumSizeInBytes: input.sizeBytes, allowedContentTypes: [input.mimeType], allowOverwrite: false, addRandomSuffix: false });
          uploadUrl = result.presignedUrl;
          assertPresignedDestination(uploadUrl, pathname);
        } catch { return unavailable(); }
        const intent = signDirectUploadIntent({ ownerId: actorId, scope: input.scope, targetId: input.targetId, projectId: target.projectId,
          environment: config.environment, storeId: config.storeId, pathname, mimeType: input.mimeType, sizeBytes: input.sizeBytes,
          issuedAt, uploadUntil, finalizeUntil: issuedAt + DIRECT_UPLOAD_RECOVERY_MS }, config.secret);
        return { intent, uploadUrl, headers: { 'Content-Type': input.mimeType }, expiresAt: new Date(uploadUntil).toISOString() };
      }
      const intent = verifyDirectUploadIntent(input.intent, config.secret, now());
      bindCurrent(intent, actorId, config);
      const authorize = async (tx: Prisma.TransactionClient) => {
        const target = await authorizeContentTargetTx(tx, actorId, intent.scope, intent.targetId, true);
        if (target.projectId !== intent.projectId) return uploadFailure(409, 'The content target changed.');
      };
      // Reject revoked users before a storage request, then check again under the
      // asset-creation transaction after the external verification has finished.
      await serializable(db, authorize);
      const url = canonicalPhotoUrl(intent.storeId, intent.pathname);
      let metadata: Awaited<ReturnType<BlobSdk['head']>>;
      let sdk: BlobSdk | undefined;
      try {
        sdk = await loadSdk();
        metadata = await sdk.head(intent.pathname, { ...config.auth, abortSignal: AbortSignal.timeout(10000) });
      } catch (error) {
        if (sdk && error instanceof sdk.BlobNotFoundError) return uploadFailure(404, 'Uploaded image was not found. Retry confirmation.');
        return uploadFailure(502, 'Image verification could not finish. Retry confirmation.');
      }
      // Provider upload timestamps have no documented clock/precision or
      // completion-before-expiry guarantee. Delegation expiry is enforced by
      // Blob; fresh exact UUID paths and no-overwrite prevent old-object reuse.
      if (metadata.url !== url || metadata.pathname !== intent.pathname || metadata.size !== intent.sizeBytes || metadata.contentType !== intent.mimeType) return mismatch();
      await verifyPrefix(fetcher, url, intent);
      return serializable(db, async tx => {
        verifyDirectUploadIntent(input.intent, config.secret, now());
        await authorize(tx);
        await tx.$queryRaw`SELECT id FROM media_asset WHERE storage_key = ${url} FOR UPDATE`;
        const existing = await tx.mediaAsset.findUnique({ where: { storageKey: url }, select: ASSET_SELECT });
        if (existing) {
          if (existing.storageKey !== url || existing.uploadedByIdentityId !== actorId || existing.kind !== 'photo' ||
              existing.mimeType !== intent.mimeType || existing.sizeBytes !== intent.sizeBytes || existing.encrypted !== false || existing.deleteAfter !== null) return mismatch();
          return { mediaAssetId: existing.id, url: existing.storageKey };
        }
        const asset = await tx.mediaAsset.create({ data: { storageKey: url, uploadedByIdentityId: actorId,
          kind: 'photo', mimeType: intent.mimeType, sizeBytes: intent.sizeBytes, encrypted: false, deleteAfter: null }, select: ASSET_SELECT });
        return { mediaAssetId: asset.id, url: asset.storageKey };
      });
    },
  };
}
