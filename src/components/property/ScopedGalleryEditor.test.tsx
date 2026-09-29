// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ScopedGalleryEditor from './ScopedGalleryEditor';

const labels: Record<string,string> = {
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
