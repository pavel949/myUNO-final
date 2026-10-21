import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const { baseUrl }=require('./isolation.cjs').assertIsolation();
require('./block-egress.cjs');
const {chromium}=require('playwright');
const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient();
const fixture=JSON.parse(await readFile('browser-results/sales-fixture.json','utf8'));
const report={synthetic:true,head:process.env.BROWSER_HEAD_SHA||null,steps:[],errors:[],result:'running'};
const contexts=[],externalRequests=[];let browser;
async function step(name,work){await work();report.steps.push(name);console.log('PASS '+name);await writeFile('browser-results/sales-offer-result.json',JSON.stringify(report,null,2));}
function session(id){const now=Date.now();const payload=`v3.${id}.none.${now}.${now+3600000}`;const signature=createHmac('sha256',process.env.SESSION_SECRET||process.env.NEXTAUTH_SECRET).update(payload).digest('base64url');return payload+'.'+signature;}
async function context(mobile=false,staff=false){const ctx=await browser.newContext({baseURL:baseUrl,viewport:mobile?{width:390,height:844}:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write'],serviceWorkers:'block'});contexts.push(ctx);await ctx.addCookies([{name:'locale',value:'en',url:baseUrl},...(staff?[{name:'auth-session',value:session(fixture.actorId),url:baseUrl}]:[])]);
await ctx.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===baseUrl&&url.pathname==='/_next/image'&&url.searchParams.get('url')?.startsWith('https://cdn.example.test/'))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="800" height="400" fill="#214e44"/></svg>'});if(url.origin===baseUrl)return route.continue();if(route.request().resourceType()==='image')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="800" height="400" fill="#214e44"/></svg>'});return route.abort();});ctx.on('request',r=>{const url=new URL(r.url());if(['http:','https:'].includes(url.protocol)&&url.origin!==baseUrl)externalRequests.push(url.origin);});ctx.on('page',p=>p.on('pageerror',e=>report.errors.push(String(e))));return ctx;}
try{
 await mkdir('browser-results',{recursive:true});browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 const staff=await context(false,true),page=await staff.newPage();let offerId,token,shareId;
 await step('Desktop staff searches canonical data, compares and saves immutable offer',async()=>{
  await page.goto('/ops/sales?spaceId='+fixture.spaceId);await page.getByLabel('Check-in',{exact:true}).fill(fixture.stay.startDate);await page.getByLabel('Check-out',{exact:true}).fill(fixture.stay.endDate);
  await page.getByRole('button',{name:'Search availability',exact:true}).click();await page.getByRole('button',{name:'Select',exact:true}).click();
  await page.getByLabel('Client language').selectOption('en');await page.getByLabel('Valid until (your local time)').fill(new Date(Date.now()+1800000).toISOString().slice(0,16));
  await page.getByLabel('Client-visible notes (optional)').fill('Synthetic client note <script>window.injected=true</script>');
  await page.getByRole('button',{name:'Save offer version'}).click();await page.waitForURL(/\/ops\/sales\/[^/?]+$/);offerId=new URL(page.url()).pathname.split('/').pop();
  assert.equal(await db.salesOffer.count({where:{id:offerId}}),1);await page.screenshot({path:'browser-results/sales-desktop.png',fullPage:true});
 });
 await step('Mobile staff desk preserves usable search and comparison controls',async()=>{const mobileStaff=await context(true,true);const mobilePage=await mobileStaff.newPage();await mobilePage.goto('/ops/sales?spaceId='+fixture.spaceId);await mobilePage.getByRole('button',{name:'Search availability',exact:true}).waitFor();assert.ok(await mobilePage.getByRole('button',{name:'Search availability',exact:true}).isVisible());assert.ok(await mobilePage.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));await mobilePage.screenshot({path:'browser-results/sales-mobile-staff.png',fullPage:true});});
 await step('Explicit staff action creates a hash-only fragment capability; no automatic send',async()=>{
  const response=page.waitForResponse(r=>r.url().endsWith('/shares')&&r.request().method()==='POST');await page.getByRole('button',{name:'Create client link',exact:true}).click();const res=await response;assert.equal(res.status(),201);const data=await res.json();token=data.token;shareId=data.id;
  const raw=await db.salesOfferShare.findUniqueOrThrow({where:{id:shareId}});assert.ok(!JSON.stringify(raw).includes(token));assert.equal(await db.notification.count({where:{identityId:fixture.guestId}}),0);
 });
 const guest=await context(true),recipient=await guest.newPage();
 await step('A temporary public-read failure offers a working retry without exposing data',async()=>{let failOnce=true;await recipient.route('**/api/proposals/view',route=>{if(failOnce){failOnce=false;return route.fulfill({status:503,contentType:'application/json',body:'{}'});}return route.continue();});await recipient.goto('/proposal#'+token);await recipient.getByRole('alert').waitFor();await recipient.getByRole('button',{name:/^Retry/}).click();await recipient.getByRole('heading',{name:'Your stay options',exact:true}).waitFor();});
 await step('Signed-out recipient sees only the sanitized mobile proposal, with no staff shell',async()=>{
  await recipient.goto('/proposal#'+token);await recipient.getByRole('heading',{name:'Your stay options',exact:true}).waitFor();assert.equal(new URL(recipient.url()).hash,'');
  const html=await recipient.content();for(const secret of [fixture.actorId,fixture.guestId,'fingerprint','guestIdentityId','WorkspaceNavigation','auth-session'])assert.ok(!html.includes(secret));assert.equal(await recipient.evaluate(()=>window.injected),undefined);
  assert.equal(await recipient.locator('nav').count(),0);assert.ok(await recipient.getByRole('link',{name:'Review this stay and contact the property'}).count());
  assert.ok(await recipient.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));await recipient.screenshot({path:'browser-results/sales-mobile-proposal.png',fullPage:true});
 });
 await step('Copy and print use the same snapshot; mobile/desktop PDF rendering is exercised',async()=>{
  await recipient.getByRole('button',{name:'Copy WhatsApp / email text'}).click();await recipient.getByRole('status').filter({hasText:'Copied'}).waitFor();
  const copied=await recipient.evaluate(()=>navigator.clipboard.readText());assert.ok(copied.includes('Synthetic Villa'));assert.ok(copied.includes('not a reservation'));
  await recipient.evaluate(()=>{window.print=()=>{window.printed=true;};});await recipient.getByRole('button',{name:'Print / Save as PDF'}).click();await recipient.waitForFunction(()=>window.printed===true);
  await recipient.emulateMedia({media:'print'});assert.equal(await recipient.locator('.controls').isVisible(),false);const pdf=await recipient.pdf({format:'A4',printBackground:true});assert.ok(pdf.byteLength>5000);await writeFile('browser-results/sales-proposal-synthetic.pdf',pdf);await recipient.emulateMedia({media:'screen'});
 });
 await step('Same-tab capability races cannot restore or print the previous snapshot',async()=>{
  const original=await db.salesOffer.findUniqueOrThrow({where:{id:offerId},include:{options:true}});
  const saved=await staff.request.post('/api/ops/sales-offers',{data:{commandId:crypto.randomUUID(),spaceId:fixture.spaceId,selections:original.options.map(o=>({unitId:o.unitId,stay:o.snapshot.stay})),locale:'en',expiresAt:original.expiresAt.toISOString(),clientNote:'Second immutable proposal'}});assert.equal(saved.status(),201);const secondId=(await saved.json()).id;
  const issued=await staff.request.post('/api/ops/sales-offers/'+secondId+'/shares',{data:{expiresAt:original.expiresAt.toISOString()}});assert.equal(issued.status(),201);const second=await issued.json();
  const racePage=await guest.newPage();let release,started;const gate=new Promise(r=>release=r),seen=new Promise(r=>started=r);let delayed=false;
  await racePage.route('**/api/proposals/view',async route=>{if(!delayed&&route.request().postDataJSON().token===token){delayed=true;const response=await route.fetch();started();await gate;await route.fulfill({response});return;}await route.continue();});
  await racePage.goto('/proposal#'+token);await seen;await racePage.evaluate(proof=>{location.hash=proof;},second.token);await racePage.getByText('Second immutable proposal',{exact:true}).waitFor();
  const obsolete=racePage.waitForResponse(r=>r.url().endsWith('/api/proposals/view')&&r.request().postDataJSON().token===token);release();await(await obsolete).finished();await racePage.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  assert.equal(await racePage.getByText('Second immutable proposal',{exact:true}).count(),1);assert.equal(await racePage.getByText('Synthetic client note <script>window.injected=true</script>',{exact:true}).count(),0);
  await racePage.evaluate(()=>{window.print=()=>{window.printedText=document.getElementById('proposal').innerText;};});await racePage.getByRole('button',{name:'Print / Save as PDF'}).click();await racePage.waitForFunction(()=>window.printedText?.includes('Second immutable proposal'));
  assert.equal((await staff.request.delete('/api/ops/sales-offers/'+secondId+'/shares',{data:{shareId:second.id}})).status(),200);await racePage.close();
 });
 await step('Public endpoint cannot create booking requests; staff retry produces exactly one requested booking',async()=>{
  const option=await db.salesOfferOption.findFirstOrThrow({where:{offerId}});
  assert.equal((await guest.request.post('/api/ops/sales-offers/'+offerId+'/request',{data:{optionId:option.id,guestId:fixture.guestId}})).status(),401);
  await page.getByLabel('Registered guest').selectOption(fixture.guestId);const wait=page.waitForResponse(r=>r.url().endsWith('/request')&&r.request().method()==='POST');await page.getByRole('button',{name:'Create booking request',exact:true}).click();assert.equal((await wait).status(),201);
  const replay=await staff.request.post('/api/ops/sales-offers/'+offerId+'/request',{data:{optionId:option.id,guestId:fixture.guestId}});assert.equal(replay.status(),201);
  assert.equal(await db.booking.count({where:{guestIdentityId:fixture.guestId}}),1);assert.equal((await db.booking.findFirstOrThrow({where:{guestIdentityId:fixture.guestId}})).status,'requested');
 });
 await step('Tariff invalidation visibly marks the old snapshot stale and disables exports/CTA',async()=>{
  await db.inventoryCategory.updateMany({where:{units:{some:{salesOfferOptions:{some:{offerId}}}}},data:{baseNightlyThb:777000}});
  await recipient.goto('/proposal#'+token);await recipient.getByRole('alert').waitFor();assert.equal(await recipient.getByRole('button',{name:'Print / Save as PDF'}).isDisabled(),true);assert.equal(await recipient.locator('a.action').count(),0);
 });
 await step('Explicit staff revocation denies the same capability to a signed-out recipient',async()=>{
  assert.equal((await staff.request.delete('/api/ops/sales-offers/'+offerId+'/shares',{data:{shareId}})).status(),200);
  await recipient.goto('/proposal#'+token);await recipient.getByRole('alert').waitFor();assert.ok((await recipient.getByRole('alert').innerText()).includes('unavailable'));assert.equal(await recipient.locator('article').count(),0);
 });
 assert.deepEqual(externalRequests,[],'No third-party request may disclose recipient details');assert.deepEqual(report.errors,[]);report.result='passed';
}catch(error){report.result='failed';report.errors.push(String(error));console.error(String(error));process.exitCode=1;}
finally{await writeFile('browser-results/sales-offer-result.json',JSON.stringify(report,null,2));for(const ctx of contexts)await ctx.close();await browser?.close();await db.$disconnect();}
