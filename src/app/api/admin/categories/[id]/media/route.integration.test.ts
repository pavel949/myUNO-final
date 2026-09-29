import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createIdentity, createProject } from '@/test/util';

vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});
vi.mock('@/app/libs/onboardingGuard', () => ({
  requireAdmin: async () => ({ ok: true }),
}));

import { GET, POST, PATCH, DELETE } from './route';

const req=(method:string,body?:unknown,url='http://localhost/api/admin/categories/category/media')=>
  new NextRequest(url,{method,...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});

describe('category gallery / shared photo invariants', () => {
  let categoryId:string;
  let assetA:string;
  let assetB:string;
  beforeEach(async () => {
    await resetDb();
    const actor=await createIdentity({isAdmin:true});
    const project=await createProject();
    const category=await db.inventoryCategory.create({data:{
      projectId:project.id,categoryKey:'deluxe',name:'Deluxe room',bedrooms:1,bathrooms:1,
      maxGuests:2,baseNightlyThb:300000,minNights:1,status:'draft',
    }});
    categoryId=category.id;
    assetA=(await db.mediaAsset.create({data:{
      uploadedByIdentityId:actor.id,kind:'photo',mimeType:'image/jpeg',sizeBytes:12,
      storageKey:'https://example.com/a.jpg',
    }})).id;
    assetB=(await db.mediaAsset.create({data:{
      uploadedByIdentityId:actor.id,kind:'photo',mimeType:'image/jpeg',sizeBytes:12,
      storageKey:'https://example.com/b.jpg',
    }})).id;
  });
  const params=()=>({params:{id:categoryId}});

  it('stores one category gallery with cover and ordered reusable assets',async()=>{
    expect((await POST(req('POST',{mediaAssetId:assetA}),params())).status).toBe(201);
    expect((await POST(req('POST',{mediaAssetId:assetB}),params())).status).toBe(201);
    expect((await POST(req('POST',{mediaAssetId:assetA}),params())).status).toBe(201);
    expect(await db.inventoryCategoryMedia.count({where:{categoryId}})).toBe(2);
    expect((await PATCH(req('PATCH',{orderedMediaIds:[assetB,assetA],coverMediaId:assetB}),params())).status).toBe(200);
    const gallery=await (await GET(req('GET'),params())).json();
    expect(gallery.coverMediaId).toBe(assetB);
    expect(gallery.galleryMedia.map((l:{mediaId:string})=>l.mediaId)).toEqual([assetB,assetA]);
  });

  it('never accepts a foreign cover or incomplete gallery order',async()=>{
    await POST(req('POST',{mediaAssetId:assetA}),params());
    expect((await PATCH(req('PATCH',{orderedMediaIds:[assetA],coverMediaId:assetB}),params())).status).toBe(400);
    expect((await PATCH(req('PATCH',{orderedMediaIds:[],coverMediaId:null}),params())).status).toBe(400);
    expect((await db.inventoryCategory.findUnique({where:{id:categoryId}}))?.coverMediaId).toBe(assetA);
  });

  it('unlinks rather than deleting shared bytes and chooses a new cover',async()=>{
    await POST(req('POST',{mediaAssetId:assetA}),params());
    await POST(req('POST',{mediaAssetId:assetB}),params());
    const del=new NextRequest(`http://localhost/api/admin/categories/${categoryId}/media?mediaId=${assetA}`,{method:'DELETE'});
    expect((await DELETE(del,params())).status).toBe(200);
    expect((await db.inventoryCategory.findUnique({where:{id:categoryId}}))?.coverMediaId).toBe(assetB);
    expect(await db.mediaAsset.count({where:{id:assetA}})).toBe(1);
  });
});
