import { describe, expect, it, vi } from 'vitest';
import { harness } from '@/modules/onboarding/content-proposal.service.test-support';
import { createDirectUploadService, directUploadConfig, type DirectUploadConfig } from './direct-upload.service';
import { DIRECT_UPLOAD_MAX_BYTES, DIRECT_UPLOAD_RECOVERY_MS, DIRECT_UPLOAD_TTL_MS, canonicalPhotoUrl,
  signDirectUploadIntent, verifyDirectUploadIntent } from './direct-upload.policy';

const now = Date.parse('2026-10-15T12:00:00Z');
const config: DirectUploadConfig = { secret: 'only-a-fake-test-signing-secret-no-real-credentials', environment: 'test-environment',
  storeId: 'teststore', auth: { token: 'fake-test-credential' } };
const uuid = '11111111-1111-4111-8111-111111111111';
const request = { action: 'initiate', scope: 'unit', targetId: 'managed-legendary-d201', mimeType: 'image/jpeg', sizeBytes: 1024 };
function setup() {
  const h = harness(); let time = now; let currentConfig = config;
  class FakeBlobNotFoundError extends Error {}
  const sdk = {
    BlobNotFoundError: FakeBlobNotFoundError,
    issueSignedToken: vi.fn(async (options: any) => ({ delegationToken: `${Buffer.from(JSON.stringify({ ...options, storeId: config.storeId })).toString('base64url')}.fake-signature`,
      clientSigningToken: 'fake-client-signing-token', validUntil: options.validUntil })),
    presignUrl: vi.fn(async (_signed: unknown, options: any) => ({ presignedUrl: `https://vercel.com/api/blob/?pathname=${encodeURIComponent(options.pathname)}&vercel-blob-signature=fake` })),
    head: vi.fn(async (pathname: string) => ({ url: canonicalPhotoUrl(config.storeId, pathname), pathname, contentType: 'image/jpeg', size: 1024,
      uploadedAt: new Date(now), etag: 'fake-etag', contentDisposition: '', downloadUrl: '', cacheControl: '' })),
  };
  const prefix = new Uint8Array(32); prefix.set([0xff, 0xd8, 0xff, 0xe0]);
  const fetcher = vi.fn(async () => new Response(prefix, { status: 206, headers: {
    'content-type': 'image/jpeg', 'content-length': '32', 'content-range': 'bytes 0-31/1024',
  } }));
  const service = createDirectUploadService(h.db, { config: () => currentConfig, sdk: async () => sdk, fetch: fetcher,
    now: () => time, uuid: () => uuid });
  const start = async (body = request) => {
    const result = await service.execute('author', body);
    if (!('intent' in result)) throw new Error('Missing mocked intent');
    return result;
  };
  const finish = (intent: string, actor = 'author') => service.execute(actor, { action: 'finalize', intent });
  return { ...h, sdk, fetcher, service, start, finish, setTime: (v: number) => { time = v; },
    setConfig: (v: DirectUploadConfig) => { currentConfig = v; } };
}

describe('direct Blob content upload (fake SDK and in-memory DB only)', () => {
  it('issues only exact path/mime/size PUT permission and keeps signing material server-side', async () => {
    const h = setup(); const result = await h.start();
    expect(Object.keys(result).sort()).toEqual(['expiresAt', 'headers', 'intent', 'uploadUrl']);
    expect(JSON.stringify(result)).not.toContain('fake-client-signing-token');
    expect(h.sdk.issueSignedToken).toHaveBeenCalledWith(expect.objectContaining({ token: 'fake-test-credential',
      pathname: `media/content/${uuid}.jpg`, operations: ['put'], validUntil: now + DIRECT_UPLOAD_TTL_MS,
      maximumSizeInBytes: 1024, allowedContentTypes: ['image/jpeg'] }));
    expect(h.sdk.presignUrl).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ operation: 'put', access: 'public',
      pathname: `media/content/${uuid}.jpg`, addRandomSuffix: false, allowOverwrite: false, maximumSizeInBytes: 1024, allowedContentTypes: ['image/jpeg'] }));
    expect(verifyDirectUploadIntent(result.intent, config.secret, now)).toMatchObject({ ownerId: 'author', scope: 'unit', targetId: request.targetId,
      projectId: 'project', storeId: 'teststore', environment: config.environment, issuedAt: now, finalizeUntil: now + DIRECT_UPLOAD_RECOVERY_MS });
    expect(h.db.mediaAsset.create).not.toHaveBeenCalled();
  });
  it('finalizes only after server metadata/signature verification and returns the legacy DTO', async () => {
    const h = setup(); const start = await h.start(); const result = await h.finish(start.intent);
    expect(result).toEqual({ mediaAssetId: expect.any(String), url: canonicalPhotoUrl('teststore', `media/content/${uuid}.jpg`) });
    expect(h.sdk.head).toHaveBeenCalledWith(`media/content/${uuid}.jpg`, expect.objectContaining(config.auth));
    expect(h.fetcher).toHaveBeenCalledWith(result.url, expect.objectContaining({ redirect: 'error', credentials: 'omit', headers: { Range: 'bytes=0-31' } }));
    expect(h.db.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: 'Serializable' }));
    expect(h.db.$queryRaw.mock.calls.some(([parts]: any) => parts.join('').includes('FROM unit WHERE id =') && parts.join('').includes('FOR SHARE'))).toBe(true);
    expect(h.db.mediaAsset.create).toHaveBeenCalledTimes(1);
    expect(h.db.unit.update).not.toHaveBeenCalled(); expect(h.db.project.update).not.toHaveBeenCalled();
  });
  it('accepts project authority only for the exact project, never inherits it to units', async () => {
    const h = setup(); h.state().roles[0] = { ...h.state().roles[0], scopeType: 'project', projectId: 'project', unitId: null };
    await expect(h.start()).rejects.toMatchObject({ status: 403 });
    await expect(h.start({ ...request, scope: 'project', targetId: 'project' })).resolves.toHaveProperty('intent');
  });
  it.each([0, -1, 0.5, DIRECT_UPLOAD_MAX_BYTES + 1, NaN])('rejects invalid expected byte size %s', async sizeBytes => {
    const h = setup(); await expect(h.start({ ...request, sizeBytes })).rejects.toMatchObject({ status: 400 });
    expect(h.sdk.issueSignedToken).not.toHaveBeenCalled();
  });
  it('allows the exact 8MiB boundary without sending bytes through this route', async () => {
    const h = setup(); await h.start({ ...request, sizeBytes: DIRECT_UPLOAD_MAX_BYTES });
    expect(h.sdk.issueSignedToken.mock.calls[0][0].maximumSizeInBytes).toBe(DIRECT_UPLOAD_MAX_BYTES);
  });
  it.each(['image/svg+xml', 'video/mp4', 'image/gif', 'text/html', 'image/jpeg; charset=UTF-8'])('rejects MIME %s', async mimeType => {
    const h = setup(); await expect(h.start({ ...request, mimeType })).rejects.toMatchObject({ status: 400 });
  });
  it.each(['url', 'ownerId', 'pathname', 'kind', 'projectId', 'metadata', 'encrypted'])('rejects client-controlled %s', async key => {
    const h = setup(); await expect(h.service.execute('author', { ...request, [key]: 'untrusted' })).rejects.toMatchObject({ status: 400 });
  });
  it('checks active identity and current grant before issuing a token', async () => {
    const h = setup(); h.state().identities[0].status = 'disabled';
    await expect(h.start()).rejects.toMatchObject({ status: 403 }); expect(h.sdk.issueSignedToken).not.toHaveBeenCalled();
  });
  it('denies inactive grants, cross-project grants and grants with a foreign organization', async () => {
    for (const changes of [{ status: 'revoked' }, { projectId: 'foreign' }, { organizationId: 'foreign' }]) {
      const h = setup(); Object.assign(h.state().roles[0], changes);
      await expect(h.start()).rejects.toMatchObject({ status: 403 }); expect(h.sdk.issueSignedToken).not.toHaveBeenCalled();
    }
  });
  it('binds the intent owner, store and environment', async () => {
    const h = setup(); const { intent } = await h.start();
    await expect(h.finish(intent, 'other')).rejects.toMatchObject({ status: 403 });
    h.setConfig({ ...config, storeId: 'foreign' }); await expect(h.finish(intent)).rejects.toMatchObject({ status: 403 });
    h.setConfig({ ...config, environment: 'production' }); await expect(h.finish(intent)).rejects.toMatchObject({ status: 403 });
    expect(h.sdk.head).not.toHaveBeenCalled();
  });
  it('rejects tampering without touching storage', async () => {
    const h = setup(); const { intent } = await h.start();
    const [payload, signature] = intent.split('.'); const data = JSON.parse(Buffer.from(payload, 'base64url').toString()); data.targetId = 'foreign';
    await expect(h.finish(`${Buffer.from(JSON.stringify(data)).toString('base64url')}.${signature}`)).rejects.toMatchObject({ status: 400 });
    expect(h.sdk.head).not.toHaveBeenCalled();
  });
  it('permits finalize recovery after PUT expiry but rejects exact recovery expiry', async () => {
    const h = setup(); const { intent } = await h.start(); h.setTime(now + DIRECT_UPLOAD_TTL_MS + 1);
    await expect(h.finish(intent)).resolves.toHaveProperty('mediaAssetId');
    h.setTime(now + DIRECT_UPLOAD_RECOVERY_MS); await expect(h.finish(intent)).rejects.toMatchObject({ status: 410 });
    expect(h.db.mediaAsset.create).toHaveBeenCalledTimes(1);
  });
  it('rechecks grant revocation and identity deactivation after bytes are verified', async () => {
    for (const revoke of [(h: ReturnType<typeof setup>) => { h.state().roles = []; },
      (h: ReturnType<typeof setup>) => { h.state().identities[0].status = 'disabled'; }]) {
      const h = setup(); const { intent } = await h.start(); const original = h.fetcher.getMockImplementation()!;
      h.fetcher.mockImplementation(async () => { const result = await original(); revoke(h); return result; });
      await expect(h.finish(intent)).rejects.toMatchObject({ status: 403 }); expect(h.db.mediaAsset.create).not.toHaveBeenCalled();
    }
  });
  it('does not allow a moved target even with a new exact grant', async () => {
    const h = setup(); const { intent } = await h.start(); h.state().units[0].projectId = 'other-project'; h.state().roles[0].projectId = 'other-project';
    await expect(h.finish(intent)).rejects.toMatchObject({ status: 409 }); expect(h.sdk.head).not.toHaveBeenCalled();
  });
  it.each(['url', 'pathname', 'contentType', 'size'])('rejects mismatched Blob %s', async field => {
    const h = setup(); const { intent } = await h.start(); const original = h.sdk.head.getMockImplementation()!;
    h.sdk.head.mockImplementation(async path => ({ ...await original(path), [field]: field === 'size' ? 2048 : 'foreign' }));
    await expect(h.finish(intent)).rejects.toMatchObject({ status: 409 }); expect(h.db.mediaAsset.create).not.toHaveBeenCalled();
  });
  it('rejects foreign stores, private hosts, credentials, query, fragment and noncanonical path aliases', async () => {
    const base = canonicalPhotoUrl('teststore', `media/content/${uuid}.jpg`);
    for (const url of [base.replace('teststore.', 'foreign.'), base.replace('.public.', '.private.'), base.replace('https://', 'https://user@'), `${base}?x=1`, `${base}#x`, base.replace('/content/', '/content/%2e%2e/content/')]) {
      const h = setup(); const { intent } = await h.start(); const original = h.sdk.head.getMockImplementation()!;
      h.sdk.head.mockImplementation(async path => ({ ...await original(path), url }));
      await expect(h.finish(intent)).rejects.toMatchObject({ status: 409 }); expect(h.fetcher).not.toHaveBeenCalled();
    }
  });
  it('reports missing Blob and transient HEAD failures without registering or reuploading', async () => {
    for (const status of [404, 502]) {
      const h = setup(); const { intent } = await h.start(); const error = status === 404 ? new h.sdk.BlobNotFoundError('fake missing blob') : new Error('sensitive backend detail');
      expect(error.name).toBe('Error');
      h.sdk.head.mockRejectedValue(error); await expect(h.finish(intent)).rejects.toMatchObject({ status });
      expect(h.db.mediaAsset.create).not.toHaveBeenCalled(); expect(h.sdk.issueSignedToken).toHaveBeenCalledTimes(1);
    }
  });
  it('rejects a fake JPEG body and cancels its stream', async () => {
    const h = setup(); const { intent } = await h.start(); const cancel = vi.fn();
    h.fetcher.mockResolvedValue(new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('<svg>'.padEnd(32))); }, cancel }), {
      status: 206, headers: { 'content-type': 'image/jpeg', 'content-range': 'bytes 0-31/1024' },
    }));
    await expect(h.finish(intent)).rejects.toMatchObject({ status: 409 }); expect(cancel).toHaveBeenCalledTimes(1); expect(h.db.mediaAsset.create).not.toHaveBeenCalled();
  });
  it('cancels immediately after a bounded prefix when the CDN ignores Range', async () => {
    const h = setup(); const { intent } = await h.start(); const cancel = vi.fn(); const chunk = new Uint8Array(1024); chunk.set([255,216,255]);
    h.fetcher.mockResolvedValue(new Response(new ReadableStream({ start(c) { c.enqueue(chunk); }, cancel }), {
      status: 200, headers: { 'content-type': 'image/jpeg', 'content-length': '1024' },
    }));
    await expect(h.finish(intent)).resolves.toHaveProperty('mediaAssetId'); expect(cancel).toHaveBeenCalledTimes(1);
  });
  it('rejects redirects, wrong range, truncated prefixes, mismatched MIME and fetch errors', async () => {
    const cases = [new Response(null, { status: 302, headers: { location: 'https://foreign.example' } }),
      new Response(new Uint8Array(32), { status: 206, headers: { 'content-type': 'image/jpeg', 'content-range': 'bytes 1-32/1024' } }),
      new Response(new Uint8Array([255,216,255]), { status: 206, headers: { 'content-type': 'image/jpeg', 'content-range': 'bytes 0-31/1024' } }),
      new Response(new Uint8Array(32), { status: 206, headers: { 'content-type': 'text/html', 'content-range': 'bytes 0-31/1024' } })];
    for (const response of cases) {
      const h = setup(); const { intent } = await h.start(); h.fetcher.mockResolvedValue(response);
      await expect(h.finish(intent)).rejects.toMatchObject({ status: 409 }); expect(h.db.mediaAsset.create).not.toHaveBeenCalled();
    }
    const h = setup(); const { intent } = await h.start(); h.fetcher.mockRejectedValue(new Error('network'));
    await expect(h.finish(intent)).rejects.toMatchObject({ status: 502 });
  });
  it('returns the same asset on replay without upserting or changing metadata', async () => {
    const h = setup(); const { intent } = await h.start(); const first = await h.finish(intent);
    await expect(h.finish(intent)).resolves.toEqual(first); expect(h.db.mediaAsset.create).toHaveBeenCalledTimes(1);
    expect(h.db.mediaAsset.upsert).not.toHaveBeenCalled(); expect(h.db.mediaAsset.update).not.toHaveBeenCalled();
  });
  it.each([{ uploadedByIdentityId: 'other' }, { kind: 'avatar' }, { mimeType: 'image/png' }, { sizeBytes: 3 },
    { encrypted: true }, { deleteAfter: new Date() }])('never replaces conflicting stored metadata %j', async changes => {
    const h = setup(); const { intent } = await h.start(); await h.finish(intent); Object.assign(h.state().assets.at(-1), changes);
    await expect(h.finish(intent)).rejects.toMatchObject({ status: 409 }); expect(h.db.mediaAsset.create).toHaveBeenCalledTimes(1);
    expect(h.db.mediaAsset.update).not.toHaveBeenCalled(); expect(h.db.mediaAsset.upsert).not.toHaveBeenCalled();
  });
  it('recovers a uniqueness race by reading and validating the winning row', async () => {
    const h = setup(); const { intent } = await h.start(); const url = canonicalPhotoUrl('teststore', `media/content/${uuid}.jpg`);
    const winner = { id: 'winner', storageKey: url, uploadedByIdentityId: 'author', kind: 'photo', mimeType: 'image/jpeg', sizeBytes: 1024, encrypted: false, deleteAfter: null };
    h.db.mediaAsset.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(winner);
    h.db.mediaAsset.create.mockRejectedValueOnce({ code: 'P2002' });
    await expect(h.finish(intent)).resolves.toEqual({ mediaAssetId: 'winner', url }); expect(h.sdk.head).toHaveBeenCalledTimes(1);
  });
  it('rechecks authorization on a known-rollback retry', async () => {
    const h = setup(); const { intent } = await h.start(); const original = h.db.$transaction.getMockImplementation()!; let calls = 0;
    h.db.$transaction.mockImplementation(async (...args: any[]) => {
      calls += 1; if (calls === 2) { h.state().roles = []; throw { code: 'P2034' }; } return original(...args);
    });
    await expect(h.finish(intent)).rejects.toMatchObject({ status: 403 }); expect(h.db.mediaAsset.create).not.toHaveBeenCalled();
  });
  it('never automatically retries an unknown commit and safely recovers using the same intent', async () => {
    const h = setup(); const { intent } = await h.start(); const original = h.db.$transaction.getMockImplementation()!;
    h.db.$transaction.mockImplementation(async (...args: any[]) => { const result = await original(...args); if (result?.mediaAssetId) throw new Error('unknown commit'); return result; });
    await expect(h.finish(intent)).rejects.toThrow('unknown commit'); expect(h.db.mediaAsset.create).toHaveBeenCalledTimes(1);
    h.db.$transaction.mockImplementation(original); await expect(h.finish(intent)).resolves.toHaveProperty('mediaAssetId');
    expect(h.db.mediaAsset.create).toHaveBeenCalledTimes(1); expect(h.sdk.issueSignedToken).toHaveBeenCalledTimes(1);
  });
  it('fails closed on mismatched server-issued delegation or nonofficial presign host', async () => {
    const h = setup(); h.sdk.issueSignedToken.mockResolvedValue({ delegationToken: `${Buffer.from(JSON.stringify({ storeId: 'foreign' })).toString('base64url')}.fake`, clientSigningToken: 'fake', validUntil: now + 1 });
    await expect(h.start()).rejects.toMatchObject({ status: 503 }); expect(h.sdk.presignUrl).not.toHaveBeenCalled();
    const other = setup(); other.sdk.presignUrl.mockResolvedValue({ presignedUrl: 'https://evil.example/api/blob/?pathname=x' });
    await expect(other.start()).rejects.toMatchObject({ status: 503 }); expect(other.db.mediaAsset.create).not.toHaveBeenCalled();
  });
  it('rejects validly signed mismatched path-extension and future timestamp invariants', async () => {
    const h = setup(); const { intent } = await h.start(); const value = verifyDirectUploadIntent(intent, config.secret, now);
    for (const change of [{ mimeType: 'image/png' as const }, { issuedAt: now + 1 }, { pathname: '../other' }]) {
      await expect(h.finish(signDirectUploadIntent({ ...value, ...change }, config.secret))).rejects.toMatchObject({ status: 400 });
    }
  });
  it.each(['store_teststore', 'TESTSTORE', 'teststore'])('normalizes trusted delegation store %s to exact object identity', async storeId => {
    const h = setup(); const original = h.sdk.issueSignedToken.getMockImplementation()!;
    h.sdk.issueSignedToken.mockImplementation(async options => { const result = await original(options);
      const data = JSON.parse(Buffer.from(result.delegationToken.split('.')[0], 'base64url').toString()); data.storeId = storeId;
      return { ...result, delegationToken: `${Buffer.from(JSON.stringify(data)).toString('base64url')}.fake-signature` }; });
    await expect(h.start()).resolves.toHaveProperty('intent');
  });
  it('sanitizes a stream-read failure and creates no asset', async () => {
    const h = setup(); const { intent } = await h.start();
    h.fetcher.mockResolvedValue(new Response(new ReadableStream({ pull(c) { c.error(new Error('sensitive URL detail')); } }), {
      status: 206, headers: { 'content-type': 'image/jpeg', 'content-range': 'bytes 0-31/1024' },
    }));
    await expect(h.finish(intent)).rejects.toMatchObject({ status: 502, message: 'Image verification could not finish. Retry confirmation.' });
    expect(h.db.mediaAsset.create).not.toHaveBeenCalled();
  });
  it.each(['40001', '40P01'])('retries only known rollback raw-lock failure %s', async code => {
    const h = setup(); const { intent } = await h.start(); const original = h.db.$transaction.getMockImplementation()!; let calls = 0;
    h.db.$transaction.mockImplementation(async (...args: any[]) => { calls += 1; if (calls === 2) throw { code: 'P2010', meta: { code } }; return original(...args); });
    await expect(h.finish(intent)).resolves.toHaveProperty('mediaAssetId'); expect(h.sdk.head).toHaveBeenCalledTimes(1);
    expect(h.db.mediaAsset.create).toHaveBeenCalledTimes(1);
  });

  it('allows rounded Blob timestamps and a transfer finishing after PUT admission expiry', async () => {
    const h = setup(); h.setTime(now + 123); const { intent } = await h.start();
    await expect(h.finish(intent)).resolves.toHaveProperty('mediaAssetId');
    const later = setup(); const { intent: laterIntent } = await later.start(); later.setTime(now + DIRECT_UPLOAD_TTL_MS + 10000);
    const original = later.sdk.head.getMockImplementation()!;
    later.sdk.head.mockImplementation(async path => ({ ...await original(path), uploadedAt: new Date(now + DIRECT_UPLOAD_TTL_MS + 5000) }));
    await expect(later.finish(laterIntent)).resolves.toHaveProperty('mediaAssetId');
  });
  it('selects fake configured credentials with existing precedence without inspecting real environment', () => {
    const env = { SESSION_SECRET: 'fake-session-secret', NEXTAUTH_SECRET: 'fake-fallback-secret', BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_TeStStOrE_FAKE',
      BLOB_STORE_ID: 'store_foreign', VERCEL_ENV: 'preview', VERCEL_PROJECT_ID: 'test-project', VERCEL_URL: 'preview-a.vercel.app', NODE_ENV: 'test' };
    expect(directUploadConfig(env)).toMatchObject({ secret: 'fake-session-secret', storeId: 'teststore', auth: { token: env.BLOB_READ_WRITE_TOKEN } });
    expect(directUploadConfig({ ...env, BLOB_READ_WRITE_TOKEN: undefined, BLOB_STORE_ID: 'store_TeStStOrE' })).toMatchObject({ storeId: 'teststore', auth: { storeId: 'TeStStOrE' } });
    expect(directUploadConfig({ SESSION_SECRET:'fake-local', BLOB_STORE_ID:'store_teststore' }).environment).toContain('local');
    expect(directUploadConfig({ ...env, SESSION_SECRET: undefined }).secret).toBe('fake-fallback-secret');
    expect(directUploadConfig({ ...env, VERCEL_ENV: 'production' }).environment).not.toBe(directUploadConfig(env).environment);
    expect(directUploadConfig({ ...env, VERCEL_URL: 'preview-a.vercel.app' }).environment).not.toBe(directUploadConfig({ ...env, VERCEL_URL: 'preview-b.vercel.app' }).environment);
    for (const bad of [{ ...env, SESSION_SECRET: undefined, NEXTAUTH_SECRET: undefined }, { ...env, BLOB_READ_WRITE_TOKEN: undefined, BLOB_STORE_ID: undefined },
      { ...env, VERCEL_BLOB_API_URL: 'https://override.invalid' }, { ...env, NEXT_PUBLIC_VERCEL_BLOB_API_URL: 'https://override.invalid' },
      { ...env, VERCEL_URL: undefined }, { ...env, VERCEL_URL: 'https://foreign.invalid' }, { ...env, VERCEL_URL: 'user@foreign.invalid' },
      { ...env, BLOB_READ_WRITE_TOKEN: 'invalid' }, { ...env, BLOB_READ_WRITE_TOKEN: undefined, BLOB_STORE_ID: 'store_invalid.host' }]) {
      expect(() => directUploadConfig(bad)).toThrow('Direct image storage is unavailable.');
    }
  });

  it.each(['image/png', 'image/webp'])('registers actual %s signatures with exact MIME/size', async mimeType => {
    const h = setup(); const { intent } = await h.start({ ...request, mimeType, sizeBytes: 32 });
    const original = h.sdk.head.getMockImplementation()!;
    h.sdk.head.mockImplementation(async path => ({ ...await original(path), contentType: mimeType, size: 32 }));
    const prefix = Buffer.alloc(32);
    if (mimeType === 'image/png') { Buffer.from([137,80,78,71,13,10,26,10]).copy(prefix); prefix.writeUInt32BE(13,8); prefix.write('IHDR',12); prefix.writeUInt32BE(1,16); prefix.writeUInt32BE(1,20); }
    else { prefix.write('RIFF',0); prefix.writeUInt32LE(24,4); prefix.write('WEBP',8); prefix.write('VP8X',12); }
    h.fetcher.mockResolvedValue(new Response(prefix, { status:206, headers:{ 'content-type':mimeType,'content-range':'bytes 0-31/32','content-length':'32' } }));
    await expect(h.finish(intent)).resolves.toHaveProperty('mediaAssetId');
  });
  it('rechecks registration expiry after external verification', async () => {
    const h = setup(); const { intent } = await h.start(); const original = h.fetcher.getMockImplementation()!;
    h.fetcher.mockImplementation(async () => { h.setTime(now + DIRECT_UPLOAD_RECOVERY_MS); return original(); });
    await expect(h.finish(intent)).rejects.toMatchObject({ status:410 }); expect(h.db.mediaAsset.create).not.toHaveBeenCalled();
  });
  it.each([{ pathname:'*' }, { operations:['put','delete'] }, { allowedContentTypes:['image/*'] }, { maximumSizeInBytes:2048 },
    { validUntil: now + DIRECT_UPLOAD_TTL_MS + 1 }])('rejects unexpectedly broadened provider delegation %j', async changes => {
    const h = setup(); const original = h.sdk.issueSignedToken.getMockImplementation()!;
    h.sdk.issueSignedToken.mockImplementation(async options => { const result = await original(options);
      const scope = JSON.parse(Buffer.from(result.delegationToken.split('.')[0],'base64url').toString());
      return { ...result, delegationToken: `${Buffer.from(JSON.stringify({ ...scope,...changes })).toString('base64url')}.fake` }; });
    await expect(h.start()).rejects.toMatchObject({ status:503 }); expect(h.sdk.presignUrl).not.toHaveBeenCalled();
  });

});

describe('administrator gallery direct upload authority', () => {
 it.each(['unit', 'project'])('allows an active administrator to upload to an existing %s without fabricating a contributor grant', async scope => {
  const h = setup(); h.state().roles = [];
  const result = await h.service.execute('admin', { ...request, scope, targetId: scope === 'unit' ? request.targetId : 'project' });
  if (!('intent' in result)) throw new Error('Missing intent');
  await expect(h.finish(result.intent, 'admin')).resolves.toHaveProperty('mediaAssetId');
  expect(h.db.unit.update).not.toHaveBeenCalled();
  expect(h.db.project.update).not.toHaveBeenCalled();
 });
 it('rejects a missing target before issuing storage authority', async () => {
  const h = setup();
  await expect(h.service.execute('admin', { ...request, targetId: 'missing-unit' })).rejects.toMatchObject({ status: 404 });
  expect(h.sdk.issueSignedToken).not.toHaveBeenCalled();
 });
 it.each(['disabled', 'revoked-admin'])('rechecks administrator authority at finalization: %s', async mode => {
  const h = setup();
  const result = await h.service.execute('admin', request);
  if (!('intent' in result)) throw new Error('Missing intent');
  const admin = h.state().identities.find((identity: { id: string }) => identity.id === 'admin');
  if (mode === 'disabled') admin.status = 'disabled'; else admin.isAdmin = false;
  await expect(h.finish(result.intent, 'admin')).rejects.toMatchObject({ status: 403 });
  expect(h.db.mediaAsset.create).not.toHaveBeenCalled();
 });
});
