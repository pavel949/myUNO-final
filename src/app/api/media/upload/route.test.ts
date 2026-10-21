import { File as NodeFile } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { DirectUploadError, parseDirectUploadRequest } from '@/modules/media/direct-upload.policy';
import { POST } from './route';

const fakes = vi.hoisted(() => ({ user: vi.fn(), storeMedia: vi.fn(), execute: vi.fn(), create: vi.fn(), db: {} }));
vi.mock('@/lib/prisma', () => ({ prisma: fakes.db }));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: fakes.user }));
vi.mock('@/modules/media', () => ({ storeMedia: fakes.storeMedia, MAX_UPLOAD_BYTES: 8 * 1024 * 1024,
  isAllowedImageType: (type: string) => ['image/jpeg','image/png','image/webp','image/svg+xml'].includes(type) }));
vi.mock('@/modules/media/direct-upload.service', () => ({ createDirectUploadService: fakes.create }));
vi.mock('@/app/libs/errorHandler', async () => {
  const { NextResponse } = await import('next/server');
  return { createPublicError: (message: string, statusCode: number) => Object.assign(new Error(message), { statusCode }),
    handleError: (error: any) => NextResponse.json({ error: 'safe error' }, { status: error.statusCode ?? 500 }) };
});
const startBody = { action: 'initiate', scope: 'unit', targetId: 'unit-id', mimeType: 'image/jpeg', sizeBytes: 1024 };
const json = (value: unknown) => new NextRequest('https://example.test/api/media/upload', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value),
});
function multipart(type = 'image/jpeg', size = 32, kind?: string) {
  const form = new FormData(); form.append('file', new NodeFile([new Uint8Array(size)], 'photo.jpg', { type }) as unknown as File);
  if (kind) form.append('kind', kind);
  return new NextRequest('https://example.test/api/media/upload', { method: 'POST', body: form });
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('File', NodeFile);
  fakes.user.mockResolvedValue({ identityId: 'session-owner' });
  fakes.create.mockReturnValue({ execute: fakes.execute });
  fakes.execute.mockImplementation(async (_actor: string, raw: unknown) => {
    const input = parseDirectUploadRequest(raw);
    return input.action === 'initiate' ? { intent: 'fake-intent', uploadUrl: 'https://vercel.com/api/blob/?pathname=opaque',
      headers: { 'Content-Type': input.mimeType }, expiresAt: '2026-10-15T12:10:00Z' } : { mediaAssetId: 'asset-id', url: 'https://test.public.blob.vercel-storage.com/opaque' };
  });
  fakes.storeMedia.mockResolvedValue({ id: 'legacy-asset', storageKey: 'https://test.public.blob.vercel-storage.com/legacy.jpg' });
});

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('POST /api/media/upload dispatch (mock service/storage, no DB or Blob)', () => {
  it('authenticates JSON initiation, passes only the session identity and returns no-store DTO', async () => {
    const response = await POST(json(startBody));
    expect(response.status).toBe(201); expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ intent: 'fake-intent', headers: { 'Content-Type': 'image/jpeg' } });
    expect(fakes.create).toHaveBeenCalledWith(fakes.db); expect(fakes.execute).toHaveBeenCalledWith('session-owner', startBody);
    expect(fakes.storeMedia).not.toHaveBeenCalled();
  });
  it('authenticates finalize and preserves {mediaAssetId,url}', async () => {
    const response = await POST(json({ action: 'finalize', intent: 'fake-intent' }));
    expect(response.status).toBe(201); expect(await response.json()).toEqual({ mediaAssetId: 'asset-id', url: 'https://test.public.blob.vercel-storage.com/opaque' });
    expect(fakes.execute).toHaveBeenCalledWith('session-owner', { action: 'finalize', intent: 'fake-intent' });
  });
  it.each([startBody, { action: 'finalize', intent: 'fake-intent' }])('rejects unauthenticated JSON before dispatch: %j', async body => {
    fakes.user.mockResolvedValue(null); const response = await POST(json(body));
    expect(response.status).toBe(401); expect(fakes.execute).not.toHaveBeenCalled();
  });
  it('handles malformed JSON, bounded streaming size and tampered action shapes safely', async () => {
    const malformed = new NextRequest('https://example.test/api/media/upload', { method:'POST', headers:{'content-type':'application/json'}, body:'{' });
    expect((await POST(malformed)).status).toBe(400);
    const large = new NextRequest('https://example.test/api/media/upload', { method:'POST', headers:{'content-type':'application/json'}, body:' '.repeat(8193) });
    expect((await POST(large)).status).toBe(413);
    expect(fakes.execute).not.toHaveBeenCalled();
    expect((await POST(json({ ...startBody, ownerId:'foreign' }))).status).toBe(400);
  });
  it.each([403,404,409,410,502,503] as const)('preserves safe direct-upload error status %s', async status => {
    fakes.execute.mockRejectedValue(new DirectUploadError(status, 'Safe upload error.'));
    const response = await POST(json({ action:'finalize', intent:'fake' })); expect(response.status).toBe(status);
    expect(response.headers.get('cache-control')).toBe('no-store'); expect(await response.json()).toEqual({ error:'Safe upload error.' });
  });
  it.each(['image/jpeg','image/png','image/webp','image/svg+xml'])('preserves legacy multipart MIME %s and existing DTO', async mimeType => {
    const response = await POST(multipart(mimeType)); expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ mediaAssetId:'legacy-asset', url:'https://test.public.blob.vercel-storage.com/legacy.jpg' });
    expect(fakes.storeMedia).toHaveBeenCalledWith(fakes.db, expect.objectContaining({ mimeType, kind:'photo', uploadedByIdentityId:'session-owner', fileName:'photo.jpg', buffer:expect.any(Buffer) }));
    expect(fakes.execute).not.toHaveBeenCalled();
  });
  it.each(['avatar','brand','photo'])('preserves legacy multipart kind %s', async kind => {
    expect((await POST(multipart('image/jpeg',32,kind))).status).toBe(201);
    expect(fakes.storeMedia.mock.calls[0][1].kind).toBe(kind);
  });
  it('preserves legacy invalid-kind fallback and exact 8MiB limit', async () => {
    expect((await POST(multipart('image/jpeg',8*1024*1024,'unrecognized'))).status).toBe(201);
    expect(fakes.storeMedia.mock.calls[0][1].kind).toBe('photo');
    expect((await POST(multipart('image/jpeg',8*1024*1024+1))).status).toBe(400);
    expect(fakes.storeMedia).toHaveBeenCalledTimes(1);
  });
  it('rejects missing multipart file, unsupported MIME and unauthenticated legacy uploads', async () => {
    const empty = new NextRequest('https://example.test/api/media/upload', { method:'POST',body:new FormData() });
    expect((await POST(empty)).status).toBe(400); expect((await POST(multipart('application/pdf'))).status).toBe(400);
    fakes.user.mockResolvedValue(null); expect((await POST(multipart())).status).toBe(401); expect(fakes.storeMedia).not.toHaveBeenCalled();
  });
  it('keeps unknown service/storage failures unsuccessful without retrying', async () => {
    fakes.execute.mockRejectedValue(new Error('unknown commit')); expect((await POST(json({action:'finalize',intent:'x'}))).status).toBe(500);
    expect(fakes.execute).toHaveBeenCalledTimes(1);
    fakes.storeMedia.mockRejectedValue(new Error('storage failure')); expect((await POST(multipart())).status).toBe(500); expect(fakes.storeMedia).toHaveBeenCalledTimes(1);
  });
});
