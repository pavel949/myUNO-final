import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdir,writeFile } from 'node:fs/promises';
const requireLocal=createRequire(resolve('scripts/e2e/seed-sales-offer.ts'));
requireLocal('./isolation.cjs').assertIsolation();
async function main(){
  const { db }=await import('@/test/util');
  const { salesFixture }=await import('@/test/sales-offer-fixture');
  try{
    if((await db.$queryRaw<{name:string}[]>`SELECT current_database() AS name`)[0]?.name!=='myuno_browser_test')throw new Error('Wrong database');
    const f=await salesFixture();
    await mkdir('browser-results',{recursive:true});
    await writeFile('browser-results/sales-fixture.json',JSON.stringify({actorId:f.actor.id,guestId:f.guest.id,spaceId:f.space.id,stay:f.stay}));
    console.log('Synthetic sales fixture prepared; no share token created.');
  }finally{await db.$disconnect();}
}
main().catch(()=>{console.error('Synthetic sales seed failed');process.exitCode=1;});
