import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createProject, createUnit, createIdentity } from '@/test/util';
const session = vi.hoisted(() => ({ identityId: null as string | null }));
vi.mock('@/lib/prisma', async () => ({ prisma: (await import('@/test/util')).db }));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: async () => session.identityId ? { identityId: session.identityId } : null }));
import { POST } from '@/app/api/admin/units/[id]/property-details/route';
const body = { action: 'sleeping_space', spaceType: 'bedroom', name: 'Bedroom 1', sortOrder: 0, beds: [{ bedType: 'double', count: 1 }], requestId: 'evidence-room-key-01' };
function post(id: string, value: unknown = body) {
  return POST(new NextRequest('http://localhost/api/admin/units/'+id+'/property-details', {method:'POST', body:JSON.stringify(value), headers:{'content-type':'application/json'}}), {params:{id}});
}
describe('sleeping-space canonical route real database', () => {
  beforeEach(async () => { await resetDb(); session.identityId = null; });
  async function fixture() {
    const project = await createProject();
    const unit = await createUnit({projectId:project.id});
    const admin = await createIdentity({isAdmin:true}); session.identityId = admin.id;
    return unit;
  }
  it('arbitrates concurrent identical requests without duplicate rooms or beds', async () => {
    const unit = await fixture();
    const replies = await Promise.all([post(unit.id),post(unit.id)]);
    expect(replies.map(r=>r.status).sort()).toEqual([200,201]);
    expect(await db.sleepingSpace.count({where:{unitId:unit.id}})).toBe(1);
    expect(await db.bed.count()).toBe(1);
    expect((await db.unit.findUniqueOrThrow({where:{id:unit.id}})).status).toBe('draft');
  });
  it('rejects concurrent conflicting payloads under the same key', async () => {
    const unit = await fixture();
    const replies = await Promise.all([post(unit.id),post(unit.id,{...body,beds:[{bedType:'single',count:2}]})]);
    expect(replies.map(r=>r.status).sort()).toEqual([201,409]);
    expect(await db.sleepingSpace.count()).toBe(1); expect(await db.bed.count()).toBe(1);
  });
  it('rolls back room insertion if the nested bed insertion fails', async () => {
    const unit = await fixture();
    await db.$executeRawUnsafe(`CREATE FUNCTION test_reject_sleeping_bed() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test nested failure'; END; $$`);
    await db.$executeRawUnsafe(`CREATE TRIGGER test_reject_sleeping_bed BEFORE INSERT ON bed FOR EACH ROW EXECUTE FUNCTION test_reject_sleeping_bed()`);
    try {
      expect((await post(unit.id)).status).toBe(400);
      expect(await db.sleepingSpace.count()).toBe(0); expect(await db.bed.count()).toBe(0);
    } finally {
      await db.$executeRawUnsafe('DROP TRIGGER test_reject_sleeping_bed ON bed');
      await db.$executeRawUnsafe('DROP FUNCTION test_reject_sleeping_bed()');
    }
  });
  it('rejects unauthenticated and nonadmin writes before inserting', async () => {
    const unit = await fixture(); session.identityId = null;
    expect((await post(unit.id)).status).toBe(401);
    session.identityId = (await createIdentity()).id;
    expect((await post(unit.id)).status).toBe(403);
    expect(await db.sleepingSpace.count()).toBe(0); expect(await db.bed.count()).toBe(0);
  });
});
