import { PrismaClient } from '@prisma/client';
import { storeMedia, MAX_UPLOAD_BYTES, isAllowedImageType } from '../src/modules/media/media.service';

const db = new PrismaClient();

type Scope = 'project' | 'unit';
type Source = {
  label: string;
  publicUrl: string;
  scope: Scope | 'mixed' | 'unresolved';
  id: string;
};

const SOURCES: Source[] = [
  { label: 'Legendary D201', publicUrl: 'https://disk.yandex.ru/d/qE65CiujPyvuEw', scope: 'unit', id: 'managed-legendary-d201' },
  { label: 'Legendary F705', publicUrl: 'https://disk.yandex.ru/d/oNKdmW3zhcF6cw', scope: 'unit', id: 'managed-legendary-f705' },
  { label: 'Legendary F706', publicUrl: 'https://disk.yandex.ru/d/skiAe43ZZ9vrOQ', scope: 'unit', id: 'managed-legendary-f706' },
  { label: 'Legendary F412', publicUrl: 'https://disk.yandex.ru/d/HCkgIKfuK4wqfQ', scope: 'unit', id: 'managed-legendary-f412' },
  { label: 'Legendary D202', publicUrl: 'https://disk.yandex.ru/d/bqoOE4zVh8XyKA', scope: 'unit', id: 'managed-legendary-d202' },
  { label: 'Legendary E204', publicUrl: 'https://disk.yandex.ru/d/FNkyTYlTOxF2Iw', scope: 'unit', id: 'managed-legendary-e204' },
  { label: 'Legendary common areas', publicUrl: 'https://disk.yandex.ru/d/dF1Xbeiv5B58Ww', scope: 'project', id: '7563342c-b7fe-4927-96d1-7705a6644c4c' },
  { label: 'The Base 230', publicUrl: 'https://disk.yandex.ru/d/FqcF41iGthaFtA', scope: 'unit', id: 'managed-base-230' },
  { label: 'The Base 245', publicUrl: 'https://disk.yandex.ru/d/-LYbSuO7j148UA', scope: 'unit', id: 'managed-base-245' },
  { label: 'The Title Heritage', publicUrl: 'https://disk.yandex.ru/d/lCSxdUN4KeXV5w', scope: 'unresolved', id: 'managed-project-title-heritage' },
  { label: 'Capri Residence', publicUrl: 'https://disk.yandex.ru/d/jVes8FVC1OWxZg', scope: 'unresolved', id: 'managed-project-capri-residence' },
  { label: 'Serenity B513', publicUrl: 'https://disk.yandex.ru/d/ZjNShuqMDqi2LQ', scope: 'unit', id: 'managed-serenity-b513' },
  { label: 'Oceanstone', publicUrl: 'https://disk.yandex.ru/d/Q5J9ggacxuGHQQ', scope: 'mixed', id: 'managed-project-oceanstone' },
];

const SYSTEM_IDENTITY_ID = '1a9b014a-d382-44e4-b7a6-b519856aa938';
const OCEANSTONE_UNIT_ID = 'managed-oceanstone-614';

type YandexItem = {
  name: string;
  type: 'file' | 'dir';
  path: string;
  mime_type?: string;
  size?: number;
  file?: string;
};

function arg(name: string, fallback?: string) {
  const prefix = `--${name}=`;
  const value = process.argv.find(v => v.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}
const apply = process.argv.includes('--apply');
const maxPerScope = Number(arg('max-per-scope', '40'));
const replaceExisting = process.argv.includes('--replace-existing');

function shouldSkip(item: YandexItem): boolean {
  const n = item.name.toLowerCase();
  if (item.type !== 'file') return true;
  if (!item.mime_type || !isAllowedImageType(item.mime_type)) return true;
  if (!item.size || item.size <= 0 || item.size > MAX_UPLOAD_BYTES) return true;
  return /(information|информац|инструкц|instruction)/i.test(n);
}

async function resource(publicUrl: string, path?: string) {
  const qs = new URLSearchParams({ public_key: publicUrl, limit: '1000' });
  if (path) qs.set('path', path);
  const res = await fetch(`https://cloud-api.yandex.net/v1/disk/public/resources?${qs}`);
  if (!res.ok) throw new Error(`Yandex API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<any>;
}

async function walk(publicUrl: string, path?: string): Promise<YandexItem[]> {
  const root = await resource(publicUrl, path);
  const items: YandexItem[] = root?._embedded?.items ?? [];
  const nested = await Promise.all(
    items.filter(i => i.type === 'dir').map(i => walk(publicUrl, i.path))
  );
  return [...items, ...nested.flat()];
}

function oceanstoneScope(item: YandexItem): { scope: Scope; id: string } {
  const base = item.name.trim();
  if (/^0\./.test(base)) return { scope: 'project', id: 'managed-project-oceanstone' };
  return { scope: 'unit', id: OCEANSTONE_UNIT_ID };
}

async function currentCount(scope: Scope, id: string): Promise<number> {
  return scope === 'unit'
    ? db.unitMedia.count({ where: { unitId: id } })
    : db.projectMedia.count({ where: { projectId: id } });
}

async function attach(scope: Scope, id: string, mediaId: string, sort: number) {
  if (scope === 'unit') {
    await db.unitMedia.upsert({
      where: { unitId_mediaId: { unitId: id, mediaId } },
      create: { unitId: id, mediaId, sort },
      update: { sort },
    });
    if (sort === 0) await db.unit.update({ where: { id }, data: { coverMediaId: mediaId } });
  } else {
    await db.projectMedia.upsert({
      where: { projectId_mediaId: { projectId: id, mediaId } },
      create: { projectId: id, mediaId, sort },
      update: { sort },
    });
    if (sort === 0) await db.project.update({ where: { id }, data: { coverMediaId: mediaId } });
  }
}

async function run() {
  if (apply && !process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required for --apply; refusing data-URI fallback.');
  }
  console.log(apply ? 'APPLY mode' : 'DRY RUN');
  console.log(`max-per-scope=${maxPerScope}; replace-existing=${replaceExisting}`);

  for (const source of SOURCES) {
    const rows = (await walk(source.publicUrl)).filter(x => !shouldSkip(x));
    if (source.scope === 'unresolved') {
      console.log(`SKIP unresolved: ${source.label}: ${rows.length} usable images; attribution must be confirmed first.`);
      continue;
    }

    const buckets = new Map<string, { scope: Scope; id: string; items: YandexItem[] }>();
    for (const item of rows) {
      const target = source.scope === 'mixed'
        ? oceanstoneScope(item)
        : { scope: source.scope as Scope, id: source.id };
      const key = `${target.scope}:${target.id}`;
      const bucket = buckets.get(key) ?? { ...target, items: [] };
      bucket.items.push(item);
      buckets.set(key, bucket);
    }

    for (const bucket of buckets.values()) {
      const existing = await currentCount(bucket.scope, bucket.id);
      if (existing && !replaceExisting) {
        console.log(`SKIP existing gallery ${bucket.scope}:${bucket.id}: ${existing} rows`);
        continue;
      }
      if (replaceExisting && apply) {
        if (bucket.scope === 'unit') {
          await db.unitMedia.deleteMany({ where: { unitId: bucket.id } });
          await db.unit.update({ where: { id: bucket.id }, data: { coverMediaId: null } });
        } else {
          await db.projectMedia.deleteMany({ where: { projectId: bucket.id } });
          await db.project.update({ where: { id: bucket.id }, data: { coverMediaId: null } });
        }
      }

      const selected = maxPerScope > 0 ? bucket.items.slice(0, maxPerScope) : bucket.items;
      console.log(`${source.label} -> ${bucket.scope}:${bucket.id}: ${selected.length}/${bucket.items.length} usable images`);
      if (!apply) continue;

      let sort = 0;
      for (const item of selected) {
        if (!item.file || !item.mime_type) continue;
        const response = await fetch(item.file);
        if (!response.ok) throw new Error(`download failed ${response.status} ${item.path}`);
        const buffer = Buffer.from(await response.arrayBuffer());
        const safePrefix = source.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const asset = await storeMedia(db, {
          buffer,
          mimeType: item.mime_type,
          kind: 'photo',
          uploadedByIdentityId: SYSTEM_IDENTITY_ID,
          fileName: `${safePrefix}-${sort}-${item.name}`,
        });
        await attach(bucket.scope, bucket.id, asset.id, sort++);
      }
    }
  }

  if (apply) {
    await db.auditLog.create({
      data: {
        actorIdentityId: SYSTEM_IDENTITY_ID,
        action: 'managed_yandex_media_import',
        entityType: 'external_system',
        entityId: 'yandex-public-managed-media',
        data: { maxPerScope, replaceExisting, sourceCount: SOURCES.length },
        at: new Date(),
      },
    });
  }
}

run()
  .finally(async () => db.$disconnect())
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
