import { afterEach, describe, expect, it, vi } from 'vitest';
import { finalizePhoto, MAX_PHOTO_BYTES, uploadPhoto, validPhoto, type PendingPhotoUpload } from './client-upload';

const API = '/api/media/upload';
const PUT_URL = 'https://vercel.com/api/blob/?pathname=media%2Fphoto.jpg&signature=synthetic';
const PHOTO_URL = 'https://store.public.blob.vercel-storage.com/media/photo.jpg';
const ID = 'a1234567-1234-4123-8123-123456789abc';
const target = { scope: 'unit', targetId: 'unit-1' } as const;
const response = (value: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: vi.fn(async () => value) }) as unknown as Response;
const initiated = (change: Record<string, unknown> = {}) => ({ intent: 'opaque-intent', uploadUrl: PUT_URL, headers: { 'Content-Type': 'image/jpeg' }, expiresAt: new Date(Date.now() + 60_000).toISOString(), ...change });
const photo = () => new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
function setup() {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response(initiated())).mockResolvedValueOnce(response(null)).mockResolvedValueOnce(response({ mediaAssetId: ID, url: PHOTO_URL }, 201));
  const onPending = vi.fn<(pending: PendingPhotoUpload) => void>();
  const onStage = vi.fn();
  const abort = new AbortController();
  return { fetcher, onPending, onStage, signal: abort.signal, abort };
}
afterEach(() => vi.restoreAllMocks());

describe('direct photo client transport', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp'])('accepts exactly 8 MiB %s, never greater, empty, or another type', type => {
    expect(validPhoto({ type, size: MAX_PHOTO_BYTES })).toBe(true);
    expect(validPhoto({ type, size: MAX_PHOTO_BYTES + 1 })).toBe(false);
    expect(validPhoto({ type, size: 0 })).toBe(false);
    expect(validPhoto({ type: 'image/svg+xml', size: 10 })).toBe(false);
    expect(validPhoto({ type: 'video/mp4', size: 10 })).toBe(false);
  });

  it.each(['unit', 'project'] as const)('sends exact %s target in JSON and bytes only to the exact signed PUT, then registers', async scope => {
    const options = setup(); const file = photo();
    await expect(uploadPhoto(file, { scope, targetId: 'assigned-1' }, options)).resolves.toEqual({ mediaAssetId: ID, url: PHOTO_URL });
    expect(options.onStage.mock.calls.flat()).toEqual(['upload_preparing', 'upload_transferring', 'upload_finalizing']);
    expect(options.onPending).toHaveBeenCalledWith({ intent: 'opaque-intent', scope, targetId: 'assigned-1' });
    expect(options.fetcher).toHaveBeenCalledTimes(3);
    const [initiateUrl, initiate] = options.fetcher.mock.calls[0];
    expect(initiateUrl).toBe(API);
    expect(initiate).toMatchObject({ method: 'POST', credentials: 'same-origin', redirect: 'error', headers: { 'Content-Type': 'application/json' } });
    expect(JSON.parse(String(initiate?.body))).toEqual({ action: 'initiate', scope, targetId: 'assigned-1', mimeType: file.type, sizeBytes: file.size });
    const [putUrl, put] = options.fetcher.mock.calls[1];
    expect(putUrl).toBe(PUT_URL);
    expect(put).toMatchObject({ method: 'PUT', body: file, headers: { 'Content-Type': file.type }, credentials: 'omit', redirect: 'error', mode: 'cors', referrerPolicy: 'no-referrer', signal: options.signal });
    expect(JSON.parse(String(options.fetcher.mock.calls[2][1]?.body))).toEqual({ action: 'finalize', intent: 'opaque-intent' });
  });

  it('sends an exact 8 MiB file and rejects one extra byte before requesting an intent', async () => {
    const options = setup();
    await uploadPhoto(new File([new Uint8Array(MAX_PHOTO_BYTES)], 'boundary.jpg', { type: 'image/jpeg' }), target, options);
    expect(JSON.parse(String(options.fetcher.mock.calls[0][1]?.body)).sizeBytes).toBe(MAX_PHOTO_BYTES);
    const rejected = setup();
    await expect(uploadPhoto(new File([new Uint8Array(MAX_PHOTO_BYTES + 1)], 'over.jpg', { type: 'image/jpeg' }), target, rejected)).rejects.toMatchObject({ key: 'upload_invalid' });
    expect(rejected.fetcher).not.toHaveBeenCalled();
  });

  it.each([
    'http://vercel.com/api/blob/?pathname=photo',
    'https://other.test/api/blob/?pathname=photo',
    'https://vercel.com.evil.test/api/blob/?pathname=photo',
    'https://user@vercel.com/api/blob/?pathname=photo',
    'https://vercel.com:444/api/blob/?pathname=photo',
    'https://vercel.com/api/blob/?pathname=photo#fragment',
    'https://vercel.com/another?pathname=photo',
    'https://vercel.com/api/blob/',
    'https://store.public.blob.vercel-storage.com/photo.jpg',
  ])('rejects an unexpected upload destination before sending bytes: %s', async uploadUrl => {
    const options = setup(); options.fetcher.mockReset().mockResolvedValueOnce(response(initiated({ uploadUrl })));
    await expect(uploadPhoto(photo(), target, options)).rejects.toMatchObject({ key: 'upload_invalid_response' });
    expect(options.fetcher).toHaveBeenCalledTimes(1); expect(options.onPending).not.toHaveBeenCalled();
  });

  it.each([
    { intent: '' }, { intent: 1 }, { intent: 'contains whitespace' }, { expiresAt: 'bad date' }, { expiresAt: '2000-01-01T00:00:00.000Z' },
    { headers: { 'Content-Type': 'image/png' } }, { headers: { 'Content-Type': 'image/jpeg', Authorization: 'secret' } }, { headers: null },
  ])('rejects malformed initiation contracts', async change => {
    const options = setup(); options.fetcher.mockReset().mockResolvedValueOnce(response(initiated(change)));
    await expect(uploadPhoto(photo(), target, options)).rejects.toMatchObject({ key: 'upload_invalid_response' });
    expect(options.fetcher).toHaveBeenCalledTimes(1);
  });

  it('preserves the original intent after a lost PUT response; explicit recovery performs only finalize', async () => {
    const options = setup();
    options.fetcher.mockReset().mockResolvedValueOnce(response(initiated())).mockRejectedValueOnce(new Error(PUT_URL)).mockResolvedValueOnce(response({ mediaAssetId: ID, url: PHOTO_URL }));
    await expect(uploadPhoto(photo(), target, options)).rejects.toMatchObject({ message: 'upload_transfer_uncertain' });
    expect(options.fetcher).toHaveBeenCalledTimes(2);
    await expect(finalizePhoto(options.onPending.mock.calls[0][0], options)).resolves.toEqual({ mediaAssetId: ID, url: PHOTO_URL });
    expect(options.fetcher.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(1);
    expect(JSON.parse(String(options.fetcher.mock.calls[2][1]?.body))).toEqual({ action: 'finalize', intent: 'opaque-intent' });
  });

  it('does not read token-bearing storage error bodies or automatically finalize unsuccessful PUT', async () => {
    const options = setup(); const storage = response({ error: PUT_URL }, 403);
    options.fetcher.mockReset().mockResolvedValueOnce(response(initiated())).mockResolvedValueOnce(storage);
    await expect(uploadPhoto(photo(), target, options)).rejects.toMatchObject({ key: 'upload_transfer_failed' });
    expect(storage.json).not.toHaveBeenCalled(); expect(options.fetcher).toHaveBeenCalledTimes(2);
  });

  it('retries lost finalization with the same opaque intent, preserving idempotent response', async () => {
    const options = setup();
    options.fetcher.mockReset().mockResolvedValueOnce(response(initiated())).mockResolvedValueOnce(response(null)).mockRejectedValueOnce(new Error('lost'))
      .mockResolvedValue(response({ mediaAssetId: ID, url: PHOTO_URL }));
    await expect(uploadPhoto(photo(), target, options)).rejects.toMatchObject({ key: 'upload_finalize_uncertain' });
    const pending = options.onPending.mock.calls[0][0];
    const one = await finalizePhoto(pending, options); const replay = await finalizePhoto(pending, options);
    expect(one).toEqual(replay);
    expect(options.fetcher.mock.calls.slice(2).map(([, init]) => JSON.parse(String(init?.body)))).toEqual(Array(3).fill({ action: 'finalize', intent: 'opaque-intent' }));
    expect(options.fetcher.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(1);
  });

  it.each(['https://untrusted.test/photo.jpg', 'http://store.public.blob.vercel-storage.com/photo.jpg', 'https://user@store.public.blob.vercel-storage.com/photo.jpg', 'https://store.public.blob.vercel-storage.com/photo.jpg?token=secret', '/media/photo.jpg'])('rejects untrusted finalized photo URLs: %s', async url => {
    const options = setup(); options.fetcher.mockReset().mockResolvedValueOnce(response({ mediaAssetId: ID, url }));
    await expect(finalizePhoto({ ...target, intent: 'opaque-intent' }, options)).rejects.toMatchObject({ key: 'upload_invalid_response' });
  });

  it.each(['initiate', 'put', 'finalize'])('stops after abort during %s, even when a mock transport returns a late response', async stage => {
    const options = setup(); let resolve!: (response: Response) => void;
    const delayed = new Promise<Response>(done => { resolve = done; });
    options.fetcher.mockReset();
    if (stage !== 'initiate') options.fetcher.mockResolvedValueOnce(response(initiated()));
    if (stage === 'finalize') options.fetcher.mockResolvedValueOnce(response(null));
    options.fetcher.mockReturnValueOnce(delayed);
    const promise = uploadPhoto(photo(), target, options);
    const rejected = expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(options.fetcher).toHaveBeenCalledTimes(stage === 'initiate' ? 1 : stage === 'put' ? 2 : 3));
    options.abort.abort(); resolve(response(stage === 'initiate' ? initiated() : { mediaAssetId: ID, url: PHOTO_URL }));
    await rejected;
    expect(options.fetcher).toHaveBeenCalledTimes(stage === 'initiate' ? 1 : stage === 'put' ? 2 : 3);
  });
});
