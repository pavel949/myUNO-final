'use client';
import { useEffect, useRef, useState } from 'react';
import { editorLabel, type PropertyEditorCopy } from '@/modules/content/property-editor.seed';
import { useRouter } from 'next/navigation';

type Photo = { mediaId: string; sort: number; media: { storageKey: string } };
export default function ManagedGallery({
  scope,
  id,
  copy,
}: {
  scope: 'unit' | 'project';
  id: string;
  copy: PropertyEditorCopy;
}) {
  const router = useRouter();
  const l = (key: string) => editorLabel(copy, key);
  const pending = useRef(false);
  const acceptedImages = ['image/jpeg', 'image/png', 'image/webp'].join(',');
  const path = `/api/admin/${scope === 'unit' ? 'units' : 'projects'}/${id}/media`;
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [coverId, setCoverId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refresh = async () => {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error(l('gallery_unavailable'));
    const payload = await response.json();
    setPhotos(scope === 'unit' ? payload.media || [] : payload.galleryMedia || []);
    setCoverId(payload.coverMediaId || null);
  };
  useEffect(() => {
    void refresh().catch(() => setError(l('gallery_unavailable')));
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps
  const action = async (run: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    let failed = false;
    try {
      await run();
    } catch {
      failed = true;
    }
    // A multi-file operation can partially commit. Always read the canonical
    // gallery even after failure so retry does not conceal already saved photos.
    try {
      await refresh();
      router.refresh();
      if (failed) setError(l('gallery_failed'));
    } catch {
      setError(l('gallery_unavailable'));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const send = async (method: string, body?: object, mediaId?: string) => {
    const response = await fetch(
      path + (mediaId ? `?mediaId=${encodeURIComponent(mediaId)}` : ''),
      {
        method,
        ...(body
          ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
          : {}),
      }
    );
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || 'Gallery update failed');
    }
  };
  const move = (index: number, offset: number) =>
    action(async () => {
      const order = photos.map((photo) => photo.mediaId);
      const target = index + offset;
      if (target < 0 || target >= order.length) return;
      [order[index], order[target]] = [order[target], order[index]];
      await send('PATCH', { orderedMediaIds: order });
    });
  return (
    <section className="mt-24 rounded-lg border border-border-line bg-surface-paper p-20">
      <h2 className="font-display text-heading-3 text-text-ink">{l('photos')}</h2>
      <p className="mt-4 text-small text-text-secondary">{l('photos_hint')}</p>
      {error && (
        <p role="alert" className="mt-8 text-state-error">
          {error}
        </p>
      )}
      <label className="mt-12 inline-flex cursor-pointer rounded-md border border-border-line px-16 py-12 text-small font-semibold">
        {l(busy ? 'saving' : 'upload')}
        <input
          className="sr-only"
          type="file"
          accept={acceptedImages}
          multiple
          disabled={busy}
          onChange={(event) => {
            const files = Array.from(event.target.files || []);
            void action(async () => {
              for (const file of files) {
                const data = new FormData();
                data.set('file', file);
                data.set('kind', 'photo');
                const uploaded = await fetch('/api/media/upload', { method: 'POST', body: data });
                const result = await uploaded.json();
                if (!uploaded.ok) throw new Error(result.error || 'Upload failed');
                await send('POST', {
                  mediaAssetId: result.mediaAssetId,
                  cover: photos.length === 0 && file === files[0],
                });
              }
            });
            event.target.value = '';
          }}
        />
      </label>
      <div className="mt-16 grid grid-cols-2 gap-12 md:grid-cols-3">
        {photos.map((photo, index) => (
          <div className="overflow-hidden rounded-md border border-border-line" key={photo.mediaId}>
            {/* MediaAsset.storageKey is the existing asset URL returned by the canonical uploader. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.media.storageKey}
              alt={l('photo').replace('{n}', String(index + 1))}
              className="h-[144px] w-full object-cover"
            />
            <div className="flex flex-wrap items-center gap-4 p-8">
              <button
                disabled={busy || coverId === photo.mediaId}
                type="button"
                onClick={() =>
                  void action(() =>
                    send('PATCH', {
                      orderedMediaIds: photos.map((p) => p.mediaId),
                      coverMediaId: photo.mediaId,
                    })
                  )
                }
                className="rounded-sm border px-8 py-4 text-small"
              >
                {l(coverId === photo.mediaId ? 'cover' : 'make_cover')}
              </button>
              <button
                disabled={busy || index === 0}
                type="button"
                aria-label={l('left')}
                onClick={() => void move(index, -1)}
                className="rounded-sm border px-8 py-4"
              >
                ←
              </button>
              <button
                disabled={busy || index === photos.length - 1}
                type="button"
                aria-label={l('right')}
                onClick={() => void move(index, 1)}
                className="rounded-sm border px-8 py-4"
              >
                →
              </button>
              <button
                disabled={busy}
                type="button"
                onClick={() => void action(() => send('DELETE', undefined, photo.mediaId))}
                className="rounded-sm border px-8 py-4 text-small"
              >
                {l('remove')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
