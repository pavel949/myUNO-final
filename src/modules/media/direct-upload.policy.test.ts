import { describe, expect, it, vi } from 'vitest';
import { DIRECT_UPLOAD_JSON_BYTES, DIRECT_UPLOAD_RECOVERY_MS, DIRECT_UPLOAD_TTL_MS, matchesPhotoSignature,
  parseDirectUploadRequest, readDirectUploadJson, signDirectUploadIntent, verifyDirectUploadIntent } from './direct-upload.policy';
const now = 1792065600000;
const secret = 'fake-local-test-key';
const payload = { ownerId: 'author', scope: 'unit' as const, targetId: 'unit-id', projectId: 'project-id', environment: 'test', storeId: 'teststore',
  pathname: 'media/content/11111111-1111-4111-8111-111111111111.jpg', mimeType: 'image/jpeg' as const, sizeBytes: 1024,
  issuedAt: now, uploadUntil: now + DIRECT_UPLOAD_TTL_MS, finalizeUntil: now + DIRECT_UPLOAD_RECOVERY_MS };

describe('direct upload strict boundary and intent policy', () => {
  it('checks the actual declared photo format signature', () => {
    expect(matchesPhotoSignature(new Uint8Array([255,216,255]), 'image/jpeg')).toBe(true);
    expect(matchesPhotoSignature(new TextEncoder().encode('<svg>'), 'image/jpeg')).toBe(false);
    const png = Buffer.alloc(32); Buffer.from([137,80,78,71,13,10,26,10]).copy(png); png.writeUInt32BE(13, 8); png.write('IHDR', 12); png.writeUInt32BE(1, 16); png.writeUInt32BE(2, 20);
    expect(matchesPhotoSignature(png, 'image/png')).toBe(true); expect(matchesPhotoSignature(png, 'image/jpeg')).toBe(false);
    png.writeUInt32BE(0,16); expect(matchesPhotoSignature(png, 'image/png')).toBe(false);
    const webp = Buffer.alloc(32); webp.write('RIFF',0); webp.write('WEBP',8); webp.write('VP8X',12);
    expect(matchesPhotoSignature(webp, 'image/webp')).toBe(true); webp.write('XXXX',12); expect(matchesPhotoSignature(webp,'image/webp')).toBe(false);
  });
  it('rejects unknown request actions, malformed scope/IDs, client URLs and private metadata', () => {
    for (const value of [null, [], { action: 'put' }, { action: 'finalize', intent: 'x', url: 'https://x' },
      { action: 'initiate', scope: 'platform', targetId: 'x', mimeType: 'image/jpeg', sizeBytes: 1 },
      { action: 'initiate', scope: 'unit', targetId: '../x', mimeType: 'image/jpeg', sizeBytes: 1 },
      { action: 'finalize', intent: '' }, { action: 'finalize', intent: 'x'.repeat(4097) }]) expect(() => parseDirectUploadRequest(value)).toThrow();
  });
  it('parses small JSON without touching file/multipart decoding', async () => {
    await expect(readDirectUploadJson(new Request('https://example.test', { method: 'POST', body: '{"action":"finalize","intent":"x"}' }))).resolves.toEqual({ action: 'finalize', intent: 'x' });
  });
  it('rejects oversize Content-Length before reading the body', async () => {
    const body = new Request('https://example.test', { method: 'POST', body: '{}', headers: { 'content-length': `${DIRECT_UPLOAD_JSON_BYTES+1}` } });
    await expect(readDirectUploadJson(body)).rejects.toMatchObject({ status: 413 }); expect(body.bodyUsed).toBe(false);
  });
  it('enforces the streaming JSON cap even with a missing/false Content-Length and cancels', async () => {
    const cancel = vi.fn(); const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(DIRECT_UPLOAD_JSON_BYTES)); c.enqueue(new Uint8Array(1)); }, cancel });
    const request = new Request('https://example.test', { method: 'POST', body: stream, duplex: 'half', headers: { 'content-length': '1' } } as RequestInit);
    await expect(readDirectUploadJson(request)).rejects.toMatchObject({ status: 413 }); expect(cancel).toHaveBeenCalledTimes(1);
  });
  it('rejects invalid JSON and missing bodies', async () => {
    await expect(readDirectUploadJson(new Request('https://example.test', { method:'POST',body:'{' }))).rejects.toMatchObject({ status:400 });
    await expect(readDirectUploadJson(new Request('https://example.test', { method:'POST' }))).rejects.toMatchObject({ status:400 });
  });
  it('signs the complete binding with a distinct protocol purpose', () => {
    const token = signDirectUploadIntent(payload, secret);
    expect(verifyDirectUploadIntent(token, secret, now)).toMatchObject(payload);
    expect(() => verifyDirectUploadIntent(token, `${secret}-other`, now)).toThrow();
    expect(() => verifyDirectUploadIntent(`${token}.extra`, secret, now)).toThrow();
    expect(() => verifyDirectUploadIntent(token.replace('.', '=.') , secret, now)).toThrow();
  });
  it('rejects a signed but internally inconsistent lifetime and target/path binding', () => {
    for (const changes of [{ uploadUntil: now }, { uploadUntil: now + DIRECT_UPLOAD_TTL_MS + 1 }, { finalizeUntil: now + 1 },
      { scope: 'project' as const }, { pathname: 'https://foreign.example/a.jpg' }, { pathname: payload.pathname.replace('.jpg','.png') },
      { sizeBytes: 0 }, { storeId: 'a.b' }]) expect(() => verifyDirectUploadIntent(signDirectUploadIntent({ ...payload,...changes },secret),secret,now)).toThrow();
  });
});
