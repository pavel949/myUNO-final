/** Browser-only direct photo transport. Never send image bytes through an application route. */
export const PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const API = '/api/media/upload';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TARGET_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/;

type PhotoMime = typeof PHOTO_MIME_TYPES[number];
export type UploadTarget = { scope: 'unit' | 'project'; targetId: string };
export type PendingPhotoUpload = UploadTarget & { intent: string };
export type UploadedPhoto = { mediaAssetId: string; url: string };
export type UploadStage = 'upload_preparing' | 'upload_transferring' | 'upload_finalizing';
type Options = {
  signal: AbortSignal;
  fetcher?: typeof fetch;
  onStage?: (stage: UploadStage) => void;
};

export class PhotoUploadError extends Error {
  constructor(readonly key: string) { super(key); }
}

function invalid(): never { throw new PhotoUploadError('upload_invalid_response'); }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}
function active(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
}
function validTarget(target: UploadTarget) {
  if (!['unit', 'project'].includes(target.scope) || typeof target.targetId !== 'string' || !TARGET_ID.test(target.targetId)) invalid();
}
function validIntent(intent: unknown): intent is string {
  return typeof intent === 'string' && intent.length > 0 && intent.length <= 8192 && !/\s/.test(intent);
}
export function validPhoto(file: Pick<File, 'size' | 'type'>): boolean {
  return PHOTO_MIME_TYPES.includes(file.type as PhotoMime) && Number.isInteger(file.size) && file.size > 0 && file.size <= MAX_PHOTO_BYTES;
}
function blobUrl(value: unknown, upload: boolean): string {
  if (typeof value !== 'string') invalid();
  let url: URL;
  try { url = new URL(value); } catch { return invalid(); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) invalid();
  if (upload) {
    if (url.hostname !== 'vercel.com' || url.pathname !== '/api/blob/' || !url.searchParams.get('pathname')) invalid();
  } else if (!/^[a-z0-9][a-z0-9-]*\.public\.blob\.vercel-storage\.com$/.test(url.hostname) || url.pathname === '/' || url.search) invalid();
  return value;
}

async function json(body: object, options: Options, finalizing = false): Promise<unknown> {
  active(options.signal);
  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)(API, {
      method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: options.signal,
    });
  } catch {
    active(options.signal);
    throw new PhotoUploadError(finalizing ? 'upload_finalize_uncertain' : 'request_error');
  }
  active(options.signal);
  if (!response.ok) {
    const key = ({ 400: 'upload_invalid', 401: 'unauthorized', 403: 'forbidden', 404: 'upload_not_found', 409: 'upload_conflict', 410: 'upload_expired' } as Record<number, string>)[response.status];
    throw new PhotoUploadError(key ?? (finalizing ? 'upload_finalize_uncertain' : 'request_error'));
  }
  try { return await response.json(); } catch { throw new PhotoUploadError(finalizing ? 'upload_finalize_uncertain' : 'upload_invalid_response'); }
}

/** Idempotent recovery: repeats registration for the original intent; never uploads bytes again. */
export async function finalizePhoto(pending: PendingPhotoUpload, options: Options): Promise<UploadedPhoto> {
  validTarget(pending);
  if (!validIntent(pending.intent)) invalid();
  options.onStage?.('upload_finalizing');
  const result = record(await json({ action: 'finalize', intent: pending.intent }, options, true));
  active(options.signal);
  if (typeof result.mediaAssetId !== 'string' || !UUID.test(result.mediaAssetId)) invalid();
  return { mediaAssetId: result.mediaAssetId, url: blobUrl(result.url, false) };
}

export async function uploadPhoto(file: File, target: UploadTarget, options: Options & {
  onPending: (pending: PendingPhotoUpload) => void;
}): Promise<UploadedPhoto> {
  validTarget(target);
  if (!validPhoto(file)) throw new PhotoUploadError('upload_invalid');
  options.onStage?.('upload_preparing');
  const result = record(await json({ action: 'initiate', scope: target.scope, targetId: target.targetId, mimeType: file.type, sizeBytes: file.size }, options));
  active(options.signal);
  if (!validIntent(result.intent) || typeof result.expiresAt !== 'string' || !Number.isFinite(Date.parse(result.expiresAt)) || Date.parse(result.expiresAt) <= Date.now()) invalid();
  const url = blobUrl(result.uploadUrl, true);
  const headers = record(result.headers);
  if (Object.keys(headers).length !== 1 || headers['Content-Type'] !== file.type) invalid();
  const pending: PendingPhotoUpload = { scope: target.scope, targetId: target.targetId, intent: result.intent };
  // Keep only the registration intent in memory, including when the PUT response is lost.
  options.onPending(pending);
  options.onStage?.('upload_transferring');
  active(options.signal);
  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)(url, {
      method: 'PUT', body: file, headers: { 'Content-Type': file.type },
      mode: 'cors', credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', signal: options.signal,
    });
  } catch {
    active(options.signal);
    throw new PhotoUploadError('upload_transfer_uncertain');
  }
  active(options.signal);
  // Never read storage error bodies or propagate fetch errors: they may contain signed URLs.
  if (!response.ok) throw new PhotoUploadError('upload_transfer_failed');
  return finalizePhoto(pending, options);
}
