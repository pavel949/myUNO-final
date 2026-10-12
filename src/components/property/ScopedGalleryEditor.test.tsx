// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ScopedGalleryEditor from './ScopedGalleryEditor';
import { galleryCopyLabelsForLocale, GALLERY_COPY_KEYS } from '@/modules/content/gallery-editor.seed';

const labels: Record<string,string> = {
 ...galleryCopyLabelsForLocale('en'),
 'admin.gallery.title':'Which gallery are you editing?',
 'admin.gallery.scope_hint':'Choose a presentation level.',
 'admin.gallery.level':'Level',
 'admin.gallery.project':'Property',
 'admin.gallery.category':'Room category',
 'admin.gallery.unit':'Physical unit',
 'admin.gallery.object':'Object',
 'admin.gallery.photos':'photos',
 'admin.gallery.hint':'Edit photos',
 'admin.gallery.add':'Add photos',
 'admin.gallery.saving':'Saving',
 'admin.gallery.loading':'Loading gallery',
 'admin.gallery.empty':'No photos',
 'admin.gallery.cover':'Cover',
 'admin.gallery.set_cover':'Set cover',
 'admin.gallery.remove':'Remove from gallery',
 'admin.gallery.safe_remove':'Unlinks only',
 'admin.gallery.saved':'Gallery saved',
};

const props = {
 projectId:'project-1', projectName:'Hotel',
 categories:[{id:'cat-1',name:'Deluxe Room'}],
 units:[{id:'unit-1',name:'Room 101'}],labels,
};
const empty = { ok:true,json:async()=>({coverMediaId:null,galleryMedia:[]}) };

describe('three-level gallery editor',()=>{
 afterEach(()=>vi.unstubAllGlobals());

 it('selects project, room category and exact physical unit independently',async()=>{
  const fetchMock=vi.fn().mockResolvedValue(empty);
  vi.stubGlobal('fetch',fetchMock);
  render(<ScopedGalleryEditor {...props}/>);
  await waitFor(()=>expect(fetchMock).toHaveBeenCalledWith('/api/admin/projects/project-1/media',{cache:'no-store'}));
  fireEvent.change(screen.getByLabelText('Level'),{target:{value:'category'}});
  await waitFor(()=>expect(fetchMock).toHaveBeenCalledWith('/api/admin/categories/cat-1/media',{cache:'no-store'}));
  fireEvent.change(screen.getByLabelText('Level'),{target:{value:'unit'}});
  await waitFor(()=>expect(fetchMock).toHaveBeenCalledWith('/api/admin/units/unit-1/media',{cache:'no-store'}));
 });

 it('reports attach failure rather than a false success message',async()=>{
  const fetchMock=vi.fn()
   .mockResolvedValueOnce(empty)
   .mockResolvedValueOnce({ok:true,json:async()=>({mediaAssetId:'media-1'})})
   .mockResolvedValueOnce({ok:false,json:async()=>({error:'Attachment denied'})});
  vi.stubGlobal('fetch',fetchMock);
  render(<ScopedGalleryEditor {...props}/>);
  await screen.findByText('No photos');
  const input=screen.getByLabelText('Add photos') as HTMLInputElement;
  fireEvent.change(input,{target:{files:[new File(['image'],'photo.png',{type:'image/png'})]}});
  await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('Attachment denied'));
  expect(screen.queryByText('Gallery saved')).not.toBeInTheDocument();
 });
});

describe('copy existing unit photo to its parent complex', () => {
 afterEach(() => vi.unstubAllGlobals());
 const sourceUrl = '/api/admin/units/unit-1/media';
 const projectUrl = '/api/admin/projects/project-1/media';
 const photo = { mediaId: 'existing-photo', sort: 0, media: {
  id: 'existing-photo', storageKey: '/existing-photo.jpg', kind: 'photo',
  mimeType: 'image/jpeg', encrypted: false, sizeBytes: 1024,
 } };
 const response = (body: object, ok = true) => ({ ok, json: async () => body });
 const source = () => response({ coverMediaId: photo.mediaId, media: [photo] });
 const destination = () => response({ coverMediaId: 'previous-cover', galleryMedia: [photo] });
 const copyLabel = labels['admin.gallery.copy_to_project'];
 const successLabel = labels['admin.gallery.copy_saved'];
 const failureLabel = labels['admin.gallery.copy_failed'];

 it('confirms the existing asset in the parent gallery before success and never unlinks or uploads', async () => {
  let confirm!: (value: ReturnType<typeof response>) => void;
  const pending = new Promise<ReturnType<typeof response>>(resolve => { confirm = resolve; });
  const fetchMock = vi.fn().mockImplementation((url, options) => {
   if (url === sourceUrl) return Promise.resolve(source());
   if (url === projectUrl && options?.method === 'POST') return Promise.resolve(response({ success: true }));
   if (url === projectUrl) return pending;
   throw new Error('Unexpected request');
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<ScopedGalleryEditor {...props} initialSelection="unit:unit-1" />);
  const button = await screen.findByRole('button', { name: copyLabel });
  fireEvent.click(button); fireEvent.click(button);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(projectUrl, { cache: 'no-store' }));
  expect(screen.queryByText(successLabel)).not.toBeInTheDocument();
  expect(button).toBeDisabled();
  expect(screen.getByLabelText('Level')).toBeDisabled();
  expect(screen.getByLabelText('Object')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Remove from gallery' })).toBeDisabled();
  expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
  expect(fetchMock).toHaveBeenCalledWith(projectUrl, {
   method: 'POST', headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({ mediaAssetId: photo.mediaId, cover: false }),
  });
  confirm(destination());
  await screen.findByText(successLabel);
  expect(screen.getByRole('button', { name: labels['admin.gallery.copy_done'] })).toBeDisabled();
  expect(screen.getByAltText('Photo 1 of Room 101')).toBeInTheDocument();
  expect(fetchMock.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(false);
  expect(fetchMock.mock.calls.some(([url]) => url === '/api/media/upload')).toBe(false);
 });

 it('surfaces authorization errors and keeps the source available', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(source())
   .mockResolvedValueOnce(response({ error: 'Forbidden' }, false));
  vi.stubGlobal('fetch', fetchMock);
  render(<ScopedGalleryEditor {...props} initialSelection="unit:unit-1" />);
  fireEvent.click(await screen.findByRole('button', { name: copyLabel }));
  await screen.findByText('Forbidden');
  expect(screen.queryByText(successLabel)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: copyLabel })).not.toBeDisabled();
  expect(screen.getByAltText('Photo 1 of Room 101')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(2);
 });

 it.each(['missing', 'denied', 'network'])('allows a safe same-asset retry when read-back is %s', async mode => {
  let verified = false;
  const fetchMock = vi.fn().mockImplementation((url, options) => {
   if (url === sourceUrl) return Promise.resolve(source());
   if (options?.method === 'POST') return Promise.resolve(response({ success: true }));
   if (verified) return Promise.resolve(destination());
   if (mode === 'network') return Promise.reject(new Error('Connection lost'));
   return Promise.resolve(response({ galleryMedia: [] }, mode !== 'denied'));
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<ScopedGalleryEditor {...props} initialSelection="unit:unit-1" />);
  fireEvent.click(await screen.findByRole('button', { name: copyLabel }));
  await screen.findByText(failureLabel);
  expect(screen.queryByText(successLabel)).not.toBeInTheDocument();
  verified = true;
  fireEvent.click(screen.getByRole('button', { name: copyLabel }));
  await screen.findByText(successLabel);
  const posts = fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST');
  expect(posts).toHaveLength(2);
  expect(posts[1]).toEqual(posts[0]);
  expect(fetchMock.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(false);
 });

 it.each(['project:project-1', 'category:cat-1'])('does not offer cross-gallery copy from %s', async selection => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(destination()));
  render(<ScopedGalleryEditor {...props} initialSelection={selection} />);
  await screen.findByRole('button', { name: 'Set cover' });
  expect(screen.queryByRole('button', { name: copyLabel })).not.toBeInTheDocument();
 });

 it('does not offer the photo-only attachment action for a video', async () => {
  const video = { ...photo, media: { ...photo.media, kind: 'video', mimeType: 'video/mp4' } };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ coverMediaId: null, media: [video] })));
  render(<ScopedGalleryEditor {...props} initialSelection="unit:unit-1" />);
  await screen.findByRole('button', { name: 'Set cover' });
  expect(screen.queryByRole('button', { name: copyLabel })).not.toBeInTheDocument();
 });

 it.each([true, false])('ignores an older unit load after changing selection (old request success=%s)', async ok => {
  let finishOld!: (value: ReturnType<typeof response>) => void;
  const oldRequest = new Promise<ReturnType<typeof response>>(resolve => { finishOld = resolve; });
  const otherPhoto = { ...photo, mediaId: 'other-photo', media: { ...photo.media, id: 'other-photo', storageKey: '/other.jpg' } };
  const fetchMock = vi.fn().mockImplementation((url, options) => {
   if (url === sourceUrl) return oldRequest;
   if (url === '/api/admin/units/unit-2/media') return Promise.resolve(response({ coverMediaId: 'other-photo', media: [otherPhoto] }));
   if (options?.method === 'POST') return Promise.resolve(response({ success: true }));
   return Promise.resolve(response({ galleryMedia: [otherPhoto] }));
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<ScopedGalleryEditor {...props} units={[...props.units, { id: 'unit-2', name: 'Room 102' }]} initialSelection="unit:unit-1" />);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(sourceUrl, { cache: 'no-store' }));
  fireEvent.change(screen.getByLabelText('Object'), { target: { value: 'unit:unit-2' } });
  await screen.findByRole('button', { name: copyLabel });
  await act(async () => { finishOld(response({ coverMediaId: photo.mediaId, media: [photo] }, ok)); });
  expect(screen.getByAltText('Photo 1 of Room 102')).toHaveAttribute('src', '/other.jpg');
  expect(screen.queryByText('Could not load gallery')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: copyLabel }));
  await screen.findByText(successLabel);
  const post = fetchMock.mock.calls.find(([, options]) => options?.method === 'POST');
  expect(JSON.parse(post?.[1].body).mediaAssetId).toBe('other-photo');
 });

 it('allows copying again after the project association is removed in the same session', async () => {
  let linked = false;
  const fetchMock = vi.fn().mockImplementation((url, options) => {
   if (url === sourceUrl) return Promise.resolve(source());
   if (options?.method === 'POST') linked = true;
   if (options?.method === 'DELETE') linked = false;
   return Promise.resolve(response({ coverMediaId: null, galleryMedia: linked ? [photo] : [] }));
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<ScopedGalleryEditor {...props} initialSelection="unit:unit-1" />);
  fireEvent.click(await screen.findByRole('button', { name: copyLabel }));
  await screen.findByText(successLabel);
  fireEvent.change(screen.getByLabelText('Level'), { target: { value: 'project' } });
  fireEvent.click(await screen.findByRole('button', { name: 'Remove from gallery' }));
  await screen.findByText('No photos');
  fireEvent.change(screen.getByLabelText('Level'), { target: { value: 'unit' } });
  fireEvent.click(await screen.findByRole('button', { name: copyLabel }));
  await screen.findByText(successLabel);
  expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(2);
  const deletes = fetchMock.mock.calls.filter(([, options]) => options?.method === 'DELETE');
  expect(deletes).toHaveLength(1);
  expect(deletes[0][0]).toBe(projectUrl + '?mediaId=' + photo.mediaId);
 });

 it('hides previously loaded unit photos when returning to that scope fails to reload', async () => {
  let reads = 0;
  const fetchMock = vi.fn().mockImplementation(url => {
   if (url === sourceUrl) return Promise.resolve(++reads === 1 ? source() : response({}, false));
   return new Promise(() => {});
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<ScopedGalleryEditor {...props} initialSelection="unit:unit-1" />);
  await screen.findByRole('button', { name: copyLabel });
  fireEvent.change(screen.getByLabelText('Level'), { target: { value: 'project' } });
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(projectUrl, { cache: 'no-store' }));
  fireEvent.change(screen.getByLabelText('Level'), { target: { value: 'unit' } });
  await screen.findByText('Could not load gallery');
  expect(screen.queryByRole('button', { name: copyLabel })).not.toBeInTheDocument();
  expect(screen.queryByAltText('Photo 1 of Room 101')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Add photos')).toBeDisabled();
  expect(screen.queryByText('Loading gallery')).not.toBeInTheDocument();
 });

 it('does not overwrite a failed source refresh with a success notice after copying', async () => {
  let reads = 0;
  const fetchMock = vi.fn().mockImplementation(url => {
   if (url === sourceUrl) return Promise.resolve(++reads === 1 ? source() : response({}, false));
   return Promise.resolve(destination());
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<ScopedGalleryEditor {...props} initialSelection="unit:unit-1" />);
  fireEvent.click(await screen.findByRole('button', { name: copyLabel }));
  await screen.findByText('Could not load gallery');
  expect(screen.queryByText(successLabel)).not.toBeInTheDocument();
  expect(screen.queryByAltText('Photo 1 of Room 101')).not.toBeInTheDocument();
 });

 it('registers complete locale drafts without publishing them', () => {
  for (const locale of ['en', 'ru', 'th', 'zh']) {
   expect(Object.values(galleryCopyLabelsForLocale(locale))).toHaveLength(4);
   expect(Object.values(galleryCopyLabelsForLocale(locale)).every(Boolean)).toBe(true);
  }
  expect(GALLERY_COPY_KEYS.every(row => row.status === 'needs_review')).toBe(true);
 });
});
