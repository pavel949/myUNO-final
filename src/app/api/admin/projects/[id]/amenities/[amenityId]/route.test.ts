import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { PATCH } from './route';
const state = vi.hoisted(() => ({ guard:vi.fn(), current:vi.fn(), update:vi.fn(), saved:vi.fn(), audit:vi.fn() }));
vi.mock('@/app/libs/projectExperienceGuard',()=>({ projectExperienceAccess:state.guard }));
vi.mock('@/modules/audit',()=>({ logAudit:state.audit }));
vi.mock('@/lib/prisma',()=>({ prisma:{ projectAmenity:{findFirst:state.current}, $transaction:async (run:(tx:unknown)=>unknown)=>run({projectAmenity:{updateMany:state.update,findUnique:state.saved}}) } }));
const row={id:'amenity',projectId:'project',name:'Pool',slug:'pool',updatedAt:new Date('2026-10-15T12:00:00.000Z'),priceThb:null,bookingRequired:false};
const params={params:{id:'project',amenityId:'amenity'}};
const request=(body:unknown)=>new NextRequest('https://example.test/api/admin/projects/project/amenities/amenity',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
beforeEach(()=>{vi.clearAllMocks();state.guard.mockResolvedValue({user:{identityId:'editor'}});state.current.mockResolvedValue(row);state.update.mockResolvedValue({count:1});state.saved.mockResolvedValue({...row,description:'New text'});});
afterEach(() => vi.restoreAllMocks());
describe('amenity scoped optimistic editing',()=>{
 it('requires an edit version',async()=>{expect((await PATCH(request({description:'New text'}),params)).status).toBe(428);expect(state.update).not.toHaveBeenCalled();});
 it('rejects stale edits before writing',async()=>{expect((await PATCH(request({expectedUpdatedAt:'2026-10-14T12:00:00.000Z'}),params)).status).toBe(409);expect(state.update).not.toHaveBeenCalled();});
 it('rejects a race detected by the atomic update predicate',async()=>{state.update.mockResolvedValue({count:0});expect((await PATCH(request({expectedUpdatedAt:row.updatedAt.toISOString()}),params)).status).toBe(409);expect(state.audit).not.toHaveBeenCalled();});
 it('binds a successful write to project, amenity and current version',async()=>{
  expect((await PATCH(request({expectedUpdatedAt:row.updatedAt.toISOString(),description:'New text'}),params)).status).toBe(200);
  expect(state.update).toHaveBeenCalledWith({where:{id:'amenity',projectId:'project',updatedAt:row.updatedAt},data:expect.objectContaining({description:'New text'})});
  expect(state.audit).toHaveBeenCalledWith(expect.objectContaining({actorIdentityId:'editor',entityId:'amenity'}));
 });
 it('rejects a foreign or missing amenity within the authorized project',async()=>{state.current.mockResolvedValue(null);expect((await PATCH(request({expectedUpdatedAt:row.updatedAt.toISOString()}),params)).status).toBe(404);expect(state.current).toHaveBeenCalledWith({where:{id:'amenity',projectId:'project'}});expect(state.update).not.toHaveBeenCalled();});
 it('returns the existing authorization denial before reading records',async()=>{state.guard.mockResolvedValue({error:new Response(null,{status:403})});expect((await PATCH(request({}),params)).status).toBe(403);expect(state.current).not.toHaveBeenCalled();});
});

it('advances the edit token on sequential same-clock writes and rejects reuse', async () => {
  let version = row.updatedAt;
  vi.spyOn(Date, 'now').mockReturnValue(row.updatedAt.getTime());
  state.current.mockImplementation(async () => ({ ...row, updatedAt: version }));
  state.update.mockImplementation(async ({ where, data }) => {
    if (where.updatedAt.getTime() !== version.getTime()) return { count: 0 };
    version = data.updatedAt;
    return { count: 1 };
  });
  state.saved.mockImplementation(async () => ({ ...row, updatedAt: version }));
  expect((await PATCH(request({ expectedUpdatedAt: row.updatedAt.toISOString() }), params)).status).toBe(200);
  expect(version.getTime()).toBe(row.updatedAt.getTime() + 1);
  expect((await PATCH(request({ expectedUpdatedAt: row.updatedAt.toISOString() }), params)).status).toBe(409);
  expect((await PATCH(request({ expectedUpdatedAt: version.toISOString() }), params)).status).toBe(200);
  expect(version.getTime()).toBe(row.updatedAt.getTime() + 2);
});
