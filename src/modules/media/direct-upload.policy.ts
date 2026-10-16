import { createHmac, timingSafeEqual } from 'node:crypto';
import { parseScope, parseTargetId, type ContentScope } from '@/modules/onboarding/content-proposal.schema';

export const DIRECT_UPLOAD_MAX_BYTES = 8 * 1024 * 1024;
export const DIRECT_UPLOAD_TTL_MS = 10 * 60 * 1000;
// This permits registration recovery only; it does not extend the PUT URL.
export const DIRECT_UPLOAD_RECOVERY_MS = 24 * 60 * 60 * 1000;
export const DIRECT_UPLOAD_JSON_BYTES = 8192;
const PURPOSE = 'myuno:content-photo-direct-upload:v1';
const MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type DirectPhotoMime = typeof MIMES[number];
export class DirectUploadError extends Error {
  constructor(readonly status: 400 | 403 | 404 | 409 | 410 | 413 | 502 | 503, message: string) {
    super(message); this.name = 'DirectUploadError';
  }
}
export const uploadFailure = (status: DirectUploadError['status'], message: string): never => { throw new DirectUploadError(status, message); };
const invalid = (): never => uploadFailure(400, 'Invalid direct upload request.');
function exact(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return invalid();
  const data = value as Record<string, unknown>;
  if (Object.keys(data).length !== keys.length || keys.some(key => !Object.prototype.hasOwnProperty.call(data, key))) return invalid();
  return data;
}
function mime(value: unknown): DirectPhotoMime {
  if (!MIMES.includes(value as DirectPhotoMime)) return invalid();
  return value as DirectPhotoMime;
}
function size(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > DIRECT_UPLOAD_MAX_BYTES) return invalid();
  return value;
}
export type DirectUploadRequest = { action: 'initiate'; scope: ContentScope; targetId: string; mimeType: DirectPhotoMime; sizeBytes: number }
  | { action: 'finalize'; intent: string };
export function parseDirectUploadRequest(value: unknown): DirectUploadRequest {
  if (value && typeof value === 'object' && 'action' in value && value.action === 'initiate') {
    const data = exact(value, ['action', 'scope', 'targetId', 'mimeType', 'sizeBytes']);
    return { action: 'initiate', scope: parseScope(data.scope), targetId: parseTargetId(data.targetId), mimeType: mime(data.mimeType), sizeBytes: size(data.sizeBytes) };
  }
  const data = exact(value, ['action', 'intent']);
  if (data.action !== 'finalize' || typeof data.intent !== 'string' || data.intent.length > 4096 || !data.intent) return invalid();
  return { action: 'finalize', intent: data.intent };
}
export async function readDirectUploadJson(request: Request): Promise<unknown> {
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > DIRECT_UPLOAD_JSON_BYTES)) return uploadFailure(413, 'Upload request is too large.');
  if (!request.body) return invalid();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > DIRECT_UPLOAD_JSON_BYTES) return uploadFailure(413, 'Upload request is too large.');
      chunks.push(part.value);
    }
  } finally { await reader.cancel().catch(() => undefined); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return invalid(); }
}
export type DirectUploadIntent = {
  version: 1; purpose: typeof PURPOSE; ownerId: string; scope: ContentScope; targetId: string; projectId: string;
  environment: string; storeId: string; pathname: string; mimeType: DirectPhotoMime; sizeBytes: number;
  issuedAt: number; uploadUntil: number; finalizeUntil: number;
};
export function photoPath(id: string, type: DirectPhotoMime): string {
  return `media/content/${id}.${type === 'image/jpeg' ? 'jpg' : type === 'image/png' ? 'png' : 'webp'}`;
}
function signature(encoded: string, secret: string): Buffer {
  // No cross-protocol reuse of a session/quote signature under the same secret.
  return createHmac('sha256', secret).update(`${PURPOSE}\0${encoded}`).digest();
}
export function signDirectUploadIntent(payload: Omit<DirectUploadIntent, 'version' | 'purpose'>, secret: string): string {
  const value: DirectUploadIntent = { version: 1, purpose: PURPOSE, ...payload };
  const encoded = Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encoded}.${signature(encoded, secret).toString('base64url')}`;
}
export function verifyDirectUploadIntent(token: string, secret: string, now: number): DirectUploadIntent {
  if (typeof token !== 'string' || token.length > 4096) return invalid();
  const parts = token.split('.');
  if (parts.length !== 2 || !parts.every(part => /^[A-Za-z0-9_-]+$/.test(part))) return invalid();
  const [encoded, signed] = parts;
  const actual = Buffer.from(signed, 'base64url'), expected = signature(encoded, secret);
  if (actual.toString('base64url') !== signed || actual.length !== expected.length || !timingSafeEqual(actual, expected)) return invalid();
  let decoded: unknown;
  try { decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')); } catch { return invalid(); }
  const data = exact(decoded, ['version', 'purpose', 'ownerId', 'scope', 'targetId', 'projectId', 'environment', 'storeId', 'pathname', 'mimeType', 'sizeBytes', 'issuedAt', 'uploadUntil', 'finalizeUntil']);
  if (data.version !== 1 || data.purpose !== PURPOSE || typeof data.ownerId !== 'string' || !data.ownerId ||
      typeof data.environment !== 'string' || !data.environment || typeof data.storeId !== 'string' || !/^[A-Za-z0-9]+$/.test(data.storeId) ||
      typeof data.pathname !== 'string' || !/^media\/content\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/.test(data.pathname)) return invalid();
  const scope = parseScope(data.scope), targetId = parseTargetId(data.targetId), projectId = parseTargetId(data.projectId);
  const mimeType = mime(data.mimeType), sizeBytes = size(data.sizeBytes);
  if (data.pathname !== photoPath(data.pathname.split('/').pop()!.split('.')[0], mimeType) || (scope === 'project' && targetId !== projectId)) return invalid();
  const { issuedAt, uploadUntil, finalizeUntil } = data;
  if (![issuedAt, uploadUntil, finalizeUntil].every(value => typeof value === 'number' && Number.isSafeInteger(value)) ||
      (issuedAt as number) > now || (uploadUntil as number) <= (issuedAt as number) ||
      (uploadUntil as number) > (issuedAt as number) + DIRECT_UPLOAD_TTL_MS ||
      finalizeUntil !== (issuedAt as number) + DIRECT_UPLOAD_RECOVERY_MS) return invalid();
  if (now >= (finalizeUntil as number)) return uploadFailure(410, 'Upload registration has expired.');
  return { ...data, scope, targetId, projectId, mimeType, sizeBytes } as DirectUploadIntent;
}
export function canonicalPhotoUrl(storeId: string, pathname: string): string {
  return `https://${storeId.toLowerCase()}.public.blob.vercel-storage.com/${pathname}`;
}
export function matchesPhotoSignature(bytes: Uint8Array, type: DirectPhotoMime): boolean {
  if (type === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/png') return bytes.length >= 24 && Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137,80,78,71,13,10,26,10])) &&
    Buffer.from(bytes.subarray(12, 16)).toString('ascii') === 'IHDR' && Buffer.from(bytes).readUInt32BE(16) > 0 && Buffer.from(bytes).readUInt32BE(20) > 0;
  return bytes.length >= 16 && Buffer.from(bytes.subarray(0, 4)).toString('ascii') === 'RIFF' &&
    Buffer.from(bytes.subarray(8, 12)).toString('ascii') === 'WEBP' && ['VP8 ', 'VP8L', 'VP8X'].includes(Buffer.from(bytes.subarray(12, 16)).toString('ascii'));
}
