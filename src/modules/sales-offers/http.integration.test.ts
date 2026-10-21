import { beforeEach,describe,it,expect,vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db,resetDb } from '@/test/util';
import { prisma } from '@/lib/prisma';
import { savedSalesFixture } from '@/test/sales-offer-fixture';
const current=vi.hoisted(()=>vi.fn());
vi.mock('@/app/actions/getCurrentUser',()=>({getCurrentUser:current}));
import { POST as save } from '@/app/api/ops/sales-offers/route';
import { POST as share,DELETE as revoke } from '@/app/api/ops/sales-offers/[id]/shares/route';
import { POST as request } from '@/app/api/ops/sales-offers/[id]/request/route';
import { POST as publicView } from '@/app/api/proposals/view/route';
import { POST as staffPreview } from '@/app/api/ops/sales-offers/[id]/preview/route';
import { GET as previewShell } from '@/app/sales-preview/[id]/route';
import { GET as publicShell } from '@/app/proposal/route';
const req=(body:unknown)=>new NextRequest('http://localhost:3000/api/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const params=(id:string)=>({params:Promise.resolve({id})});
describe('sales offer HTTP capability and auth boundaries',()=>{
 beforeEach(async()=>{await resetDb();current.mockReset();current.mockResolvedValue(null);});
 it('returns 401 for every privileged command when signed out',async()=>{
  for(const response of [await save(req({})),await share(req({}),params('x')),await revoke(req({}),params('x')),await request(req({}),params('x')),await staffPreview(req({}),params('x'))])expect(response.status).toBe(401);
 });
 it('grants only the public projection without a staff session or private cache',async()=>{
  const f=await savedSalesFixture();current.mockResolvedValue({identityId:f.actor.id});const issued=await share(req({expiresAt:f.input.expiresAt}),params(f.saved.id));expect(issued.status).toBe(201);const capability=await issued.json();
  current.mockResolvedValue(null);const response=await publicView(req({token:capability.token}));expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toBe('private, no-store');const json=await response.json();
  expect(json.current).toBe(true);expect(json.text).toContain('Synthetic Villa');expect(JSON.stringify(json)).not.toContain(f.guest.email);expect(JSON.stringify(json)).not.toMatch(/tokenHash|createdByIdentityId|fingerprint|validationId/);
  const option=await db.salesOfferOption.findFirstOrThrow();expect((await request(req({optionId:option.id,guestId:f.guest.id}),params(f.saved.id))).status).toBe(401);
 });
 it('denies foreign staff read/export/share/revoke/request and returns no related identity details',async()=>{
  const f=await savedSalesFixture();current.mockResolvedValue({identityId:f.stranger.id});
  for(const response of [await share(req({expiresAt:f.input.expiresAt}),params(f.saved.id)),await revoke(req({shareId:'x'}),params(f.saved.id)),await request(req({optionId:'x',guestId:f.guest.id}),params(f.saved.id))]){expect(response.status).toBe(403);expect(await response.text()).not.toContain(f.guest.email);}
 });
 it('serves a standalone no-store no-referrer document with no app hydration or session lookup',async()=>{
  const response=await publicShell();const html=await response.text();expect(response.status).toBe(200);expect(html).not.toMatch(/self\.__next_f|WorkspaceNavigation|guestIdentityId|auth-session/);expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'none'");expect(current).not.toHaveBeenCalled();
 });
 it('keeps the authenticated preview and its print document free of the application shell',async()=>{const f=await savedSalesFixture();current.mockResolvedValue({identityId:f.actor.id});const response=await previewShell(req({}),params(f.saved.id));const html=await response.text();expect(html).not.toMatch(/self\.__next_f|WorkspaceNavigation|guestIdentityId/);const data=await staffPreview(req({}),params(f.saved.id));expect(data.status).toBe(200);expect(JSON.stringify(await data.json())).not.toContain(f.guest.email);});
 it('returns generic unavailable for guessed and revoked capabilities',async()=>{
  expect((await publicView(req({token:'not-a-capability'}))).status).toBe(404);
  const f=await savedSalesFixture();current.mockResolvedValue({identityId:f.actor.id});const issued=await share(req({expiresAt:f.input.expiresAt}),params(f.saved.id));const capability=await issued.json();
  expect((await revoke(req({shareId:capability.id}),params(f.saved.id))).status).toBe(200);
  expect((await publicView(req({token:capability.token}))).status).toBe(404);
 });
 it.each(['membership','unit'] as const)('withdraws a public capability immediately after issuer %s scope is removed',async boundary=>{const f=await savedSalesFixture();current.mockResolvedValue({identityId:f.actor.id});const issued=await share(req({expiresAt:f.input.expiresAt}),params(f.saved.id));const capability=await issued.json();if(boundary==='membership')await db.operatingSpaceMember.updateMany({where:{identityId:f.actor.id},data:{active:false}});else await db.operatingSpaceUnit.updateMany({where:{operatingSpaceId:f.space.id},data:{active:false}});current.mockResolvedValue(null);const response=await publicView(req({token:capability.token}));expect(response.status).toBe(404);expect(await response.text()).toBe('{"code":"NOT_FOUND"}');});
 it('keeps unexpected storage failures retryable without leaking errors or mutating data',async()=>{
  const f=await savedSalesFixture();current.mockResolvedValue({identityId:f.actor.id});
  const spy=vi.spyOn(prisma.salesOfferShare,'create').mockRejectedValueOnce(new Error('PRIVATE_DATABASE_DETAILS'));
  try{const response=await share(req({expiresAt:f.input.expiresAt}),params(f.saved.id));expect(response.status).toBe(500);expect(await response.text()).toBe('{"code":"RETRY_REQUIRED"}');}finally{spy.mockRestore();}
 });
});
