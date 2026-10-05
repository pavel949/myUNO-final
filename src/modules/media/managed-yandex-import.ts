import { PrismaClient } from '@prisma/client';
import { storeMedia, isAllowedImageType, MAX_UPLOAD_BYTES } from './media.service';

export type ManagedMediaScope = 'project' | 'unit' | 'mixed' | 'archive';

export type ManagedMediaSource = {
  key: string;
  label: string;
  publicUrl: string;
  scope: ManagedMediaScope;
  id: string;
};

export const MANAGED_YANDEX_SOURCES: ManagedMediaSource[] = [
  { key: 'legendary-d201', label: 'Legendary D201', publicUrl: 'https://disk.yandex.ru/d/qE65CiujPyvuEw', scope: 'unit', id: 'managed-legendary-d201' },
  { key: 'legendary-f705', label: 'Legendary F705', publicUrl: 'https://disk.yandex.ru/d/oNKdmW3zhcF6cw', scope: 'unit', id: 'managed-legendary-f705' },
  { key: 'legendary-f706', label: 'Legendary F706', publicUrl: 'https://disk.yandex.ru/d/skiAe43ZZ9vrOQ', scope: 'unit', id: 'managed-legendary-f706' },
  { key: 'legendary-f412', label: 'Legendary F412', publicUrl: 'https://disk.yandex.ru/d/HCkgIKfuK4wqfQ', scope: 'unit', id: 'managed-legendary-f412' },
  { key: 'legendary-d202', label: 'Legendary D202', publicUrl: 'https://disk.yandex.ru/d/bqoOE4zVh8XyKA', scope: 'unit', id: 'managed-legendary-d202' },
  { key: 'legendary-e204', label: 'Legendary E204', publicUrl: 'https://disk.yandex.ru/d/FNkyTYlTOxF2Iw', scope: 'unit', id: 'managed-legendary-e204' },
  { key: 'legendary-project', label: 'Legendary common areas', publicUrl: 'https://disk.yandex.ru/d/dF1Xbeiv5B58Ww', scope: 'project', id: '7563342c-b7fe-4927-96d1-7705a6644c4c' },
  { key: 'base-230', label: 'The Base 230', publicUrl: 'https://disk.yandex.ru/d/FqcF41iGthaFtA', scope: 'unit', id: 'managed-base-230' },
  { key: 'base-245', label: 'The Base 245', publicUrl: 'https://disk.yandex.ru/d/-LYbSuO7j148UA', scope: 'unit', id: 'managed-base-245' },
  // These folders do not identify a physical unit. Preserve their files as
  // MediaAssets + source provenance, but do not claim they are exact-unit media.
  { key: 'title-heritage-unresolved', label: 'The Title Heritage', publicUrl: 'https://disk.yandex.ru/d/lCSxdUN4KeXV5w', scope: 'archive', id: 'managed-project-title-heritage' },
  { key: 'capri-unresolved', label: 'Capri Residence', publicUrl: 'https://disk.yandex.ru/d/jVes8FVC1OWxZg', scope: 'archive', id: 'managed-project-capri-residence' },
  { key: 'serenity-b513', label: 'Serenity B513', publicUrl: 'https://disk.yandex.ru/d/ZjNShuqMDqi2LQ', scope: 'unit', id: 'managed-serenity-b513' },
  { key: 'oceanstone', label: 'Oceanstone', publicUrl: 'https://disk.yandex.ru/d/Q5J9ggacxuGHQQ', scope: 'mixed', id: 'managed-project-oceanstone' },
];

const SYSTEM_IDENTITY_ID = '1a9b014a-d382-44e4-b7a6-b519856aa938';
const OCEANSTONE_UNIT_ID = 'managed-oceanstone-614';
const SOURCE_SYSTEM_ID = 'yandex-public-managed-media';

type YandexItem = {
  name: string;
  type: 'file' | 'dir';
  path: string;
  mime_type?: string;
  size?: number;
  file?: string;
  preview?: string;
};

function shouldIgnore(item: YandexItem) {
  if (item.type !== 'file') return true;
  const name = item.name.toLowerCase();
  return /(information|информац|instruction|инструкц)/i.test(name);
}

async function resource(publicUrl: string, path?: string) {
  const qs = new URLSearchParams({
    public_key: publicUrl,
    limit: '1000',
    preview_size: 'XXXL',
    preview_crop: 'false',
  });
  if (path) qs.set('path', path);
  const res = await fetch(`https://cloud-api.yandex.net/v1/disk/public/resources?${qs}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Yandex API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<any>;
}

async function walk(publicUrl: string, path?: string): Promise<YandexItem[]> {
  const root = await resource(publicUrl, path);
  const items: YandexItem[] = root?._embedded?.items ?? [];
  const nested = await Promise.all(items.filter(i => i.type === 'dir').map(i => walk(publicUrl, i.path)));
  return [...items, ...nested.flat()];
}

function targetFor(source: ManagedMediaSource, item: YandexItem): { scope: 'project' | 'unit'; id: string } | null {
  if (source.scope === 'archive') return null;
  if (source.scope === 'project' || source.scope === 'unit') return { scope: source.scope, id: source.id };
  // Oceanstone source naming convention: 0.* is building/common area;
  // numbered room photos (1.*, 2.*, ...) belong to managed unit 614.
  if (/^0\./.test(item.name.trim())) return { scope: 'project', id: source.id };
  return { scope: 'unit', id: OCEANSTONE_UNIT_ID };
}

async function mappedAssetId(db: PrismaClient, sourceUrl: string, path: string): Promise<string | null> {
  const externalId = `${sourceUrl}#${path}`;
  const rows = await db.$queryRaw<Array<{ internal_id: string }>>`
    select internal_id
    from external_mapping
    where external_system_id = ${SOURCE_SYSTEM_ID}
      and entity_type = 'media_asset'
      and external_id = ${externalId}
    limit 1
  `;
  return rows[0]?.internal_id ?? null;
}

async function registerAssetSource(db: PrismaClient, mediaId: string, source: ManagedMediaSource, item: YandexItem) {
  const externalId = `${source.publicUrl}#${item.path}`;
  await db.$executeRaw`
    insert into external_mapping
      (id, created_at, updated_at, external_system_id, entity_type, internal_id, external_id, external_version, last_seen_at, metadata)
    values
      (gen_random_uuid()::text, now(), now(), ${SOURCE_SYSTEM_ID}, 'media_asset', ${mediaId}, ${externalId}, 1, now(),
       jsonb_build_object('source_folder', ${source.publicUrl}, 'source_path', ${item.path}, 'source_name', ${item.name}, 'ingest_variant', 'yandex_xxxl_preview'))
    on conflict (external_system_id, entity_type, external_id)
    do update set updated_at = now(), internal_id = excluded.internal_id, last_seen_at = now(), metadata = excluded.metadata
  `;
}

async function attach(db: PrismaClient, target: { scope: 'project' | 'unit'; id: string }, mediaId: string) {
  if (target.scope === 'unit') {
    const existing = await db.unitMedia.findUnique({ where: { unitId_mediaId: { unitId: target.id, mediaId } } });
    if (existing) return false;
    const sort = await db.unitMedia.count({ where: { unitId: target.id } });
    await db.unitMedia.create({ data: { unitId: target.id, mediaId, sort } });
    if (sort === 0) await db.unit.update({ where: { id: target.id }, data: { coverMediaId: mediaId } });
    return true;
  }
  const existing = await db.projectMedia.findUnique({ where: { projectId_mediaId: { projectId: target.id, mediaId } } });
  if (existing) return false;
  const sort = await db.projectMedia.count({ where: { projectId: target.id } });
  await db.projectMedia.create({ data: { projectId: target.id, mediaId, sort } });
  if (sort === 0) await db.project.update({ where: { id: target.id }, data: { coverMediaId: mediaId } });
  return true;
}

async function ingestPreview(db: PrismaClient, source: ManagedMediaSource, item: YandexItem) {
  const existing = await mappedAssetId(db, source.publicUrl, item.path);
  if (existing) return { mediaId: existing, reused: true };

  if (!item.preview) throw new Error(`No preview available for ${item.path}`);
  const response = await fetch(item.preview, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Preview download failed ${response.status}: ${item.path}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const mimeType = (response.headers.get('content-type') || 'image/jpeg').split(';')[0];
  if (!isAllowedImageType(mimeType)) throw new Error(`Unsupported preview media type ${mimeType}: ${item.path}`);
  if (buffer.byteLength <= 0 || buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error(`Preview size out of bounds: ${item.path}`);
  }

  const prefix = source.key.replace(/[^a-z0-9-]+/gi, '-');
  const base = item.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 80) || 'photo';
  const ext = mimeType === 'image/webp' ? 'webp' : mimeType === 'image/png' ? 'png' : 'jpg';
  const asset = await storeMedia(db, {
    buffer,
    mimeType,
    kind: 'photo',
    uploadedByIdentityId: SYSTEM_IDENTITY_ID,
    fileName: `${prefix}-${base}.${ext}`,
  });
  await registerAssetSource(db, asset.id, source, item);
  return { mediaId: asset.id, reused: false };
}

export async function importManagedYandexBatch(
  db: PrismaClient,
  input: { sourceKey: string; offset?: number; limit?: number },
) {
  const source = MANAGED_YANDEX_SOURCES.find(s => s.key === input.sourceKey);
  if (!source) throw new Error(`Unknown managed media source: ${input.sourceKey}`);
  const offset = Math.max(0, Math.trunc(input.offset ?? 0));
  const limit = Math.min(25, Math.max(1, Math.trunc(input.limit ?? 10)));

  const all = (await walk(source.publicUrl))
    .filter(item => !shouldIgnore(item))
    .filter(item => item.type === 'file' && Boolean(item.preview));
  const batch = all.slice(offset, offset + limit);

  let created = 0;
  let reused = 0;
  let attached = 0;
  const errors: Array<{ path: string; error: string }> = [];

  for (const item of batch) {
    try {
      const result = await ingestPreview(db, source, item);
      result.reused ? reused++ : created++;
      const target = targetFor(source, item);
      if (target && await attach(db, target, result.mediaId)) attached++;
    } catch (error) {
      errors.push({ path: item.path, error: error instanceof Error ? error.message : String(error) });
    }
  }

  const nextOffset = offset + batch.length;
  const done = nextOffset >= all.length;
  await db.auditLog.create({
    data: {
      actorIdentityId: SYSTEM_IDENTITY_ID,
      action: 'managed_yandex_media_batch_import',
      entityType: 'external_system',
      entityId: SOURCE_SYSTEM_ID,
      data: {
        sourceKey: source.key,
        sourceLabel: source.label,
        offset,
        limit,
        batchSize: batch.length,
        total: all.length,
        created,
        reused,
        attached,
        errors,
        done,
      },
      at: new Date(),
    },
  });

  return {
    sourceKey: source.key,
    sourceLabel: source.label,
    scope: source.scope,
    total: all.length,
    offset,
    batchSize: batch.length,
    created,
    reused,
    attached,
    errors,
    nextOffset,
    done,
  };
}
