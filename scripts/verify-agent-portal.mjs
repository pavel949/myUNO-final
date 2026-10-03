import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { chromium } from 'playwright';

const database=new URL(process.env.DATABASE_URL_TEST??'');
assert(['localhost','127.0.0.1'].includes(database.hostname) && /test/i.test(database.pathname),
  'Runtime verification requires an isolated local test database');
assert(process.env.DATABASE_URL===process.env.DATABASE_URL_TEST,'App and verification must share the isolated test database');
const db=new PrismaClient();
const prefix='agent-runtime-'+randomUUID().slice(0,8);
const origin='http://127.0.0.1:3000';
const report={checks:[],browserErrors:[],screenshots:[]};
await mkdir('artifacts/agent',{recursive:true});
function session(id) {
 const payload=id+'.'+(Date.now()+3600000);
 return 'v1.'+payload+'.'+createHmac('sha256',process.env.NEXTAUTH_SECRET).update(payload).digest('base64url');
}
const identity=async(name,admin=false)=>db.identity.create({data:{
 firstName:name,lastName:prefix,email:name+'-'+prefix+'@example.com',status:'active',isAdmin:admin,
}});
const admin=await identity('Coordinator',true);
const agent=await identity('Agent');
const other=await identity('Other');
const org=await db.organization.create({data:{
 name:prefix,orgType:'brokerage',contactEmail:agent.email,contactPhone:'',
 memberships:{create:{identityId:agent.id,role:'manager'}},crmWorkspace:{create:{}},
},include:{crmWorkspace:true}});
const otherOrg=await db.organization.create({data:{
 name:prefix+'-other',orgType:'brokerage',contactEmail:other.email,contactPhone:'',
 memberships:{create:{identityId:other.id,role:'manager'}},crmWorkspace:{create:{}},
},include:{crmWorkspace:true}});
const project=await db.project.create({data:{
 slug:prefix,name:'Runtime verified project',areaLabelKey:'test.area',descriptionKey:'test.description',handbookKey:'test.handbook',
 latitude:'7.9',longitude:'98.3',address:'Isolated test address',timezone:'Asia/Bangkok',status:'live',
}});
const photo=await db.mediaAsset.create({data:{
 uploadedByIdentityId:admin.id,kind:'photo',mimeType:'image/jpeg',storageKey:'https://example.com/test.jpg',sizeBytes:10,
}});
const proof=await db.mediaAsset.create({data:{
 uploadedByIdentityId:admin.id,kind:'document',mimeType:'application/pdf',encrypted:true,storageKey:'private:'+prefix,sizeBytes:10,
}});
const unit=await db.unit.create({data:{
 projectId:project.id,name:'Runtime verified villa',unitType:'villa',bedrooms:3,bathrooms:3,maxGuests:6,
 baseNightlyThb:10000,minNights:1,addressSupplement:'Test',status:'live',coverMediaId:photo.id,
}});
for(const kind of ['title_legal_use','sale_authority']) await db.regulatoryCredential.create({data:{
 requirementKey:kind,credentialType:kind,scopeLevel:'unit',unitId:unit.id,status:'active',
 verificationStatus:'verified',evidenceMediaId:proof.id,
}});
const offering=await db.commercialOffering.create({data:{
 unitId:unit.id,projectId:project.id,offeringType:'sale',status:'active',
}});
let server;
let browser;
const serverLogs=[];
try {
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3000'],{
  env:{...process.env,NODE_ENV:'production',NEXTAUTH_URL:origin},stdio:['ignore','pipe','pipe'],
 });
 server.stdout.on('data',b=>serverLogs.push(String(b)));
 server.stderr.on('data',b=>serverLogs.push(String(b)));
 let ready=false;
 for(let attempt=0;attempt<90;attempt++) {
  try {if((await fetch(origin+'/partners/agents')).status===200){ready=true;break;}}catch{}
  if(server.exitCode!==null) throw new Error('Production server exited early');
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 assert(ready,'Production server must start');
 browser=await chromium.launch({headless:true});
 async function context(user) {
  const ctx=await browser.newContext();
  await ctx.addCookies([{name:'locale',value:'en',url:origin},
    ...(user?[{name:'auth-session',value:session(user.id),url:origin}]:[])]);
  return ctx;
 }
 const agentCtx=await context(agent),adminCtx=await context(admin),otherCtx=await context(other),clientCtx=await context(null);
 const page=await agentCtx.newPage();
 page.on('pageerror',error=>report.browserErrors.push(error.message));
 const workspace=org.crmWorkspace.id;
 const agentUrl=section=>origin+'/agent/'+section+'?workspace='+workspace;
 const api=resource=>origin+'/api/agent/'+workspace+'/'+resource;
 async function post(ctx,url,input,status=200,headers={}) {
  const response=await ctx.request.post(url,{data:input,headers});
  assert.equal(response.status(),status,await response.text());
  return status===200?response.json():null;
 }
 async function clickSubmit(label,path) {
  const pending=page.waitForResponse(r=>r.url().includes(path)&&r.request().method()==='POST');
  await page.getByRole('button',{name:label,exact:true}).click();
  const response=await pending;
  assert.equal(response.status(),200,await response.text());
  return response.json();
 }
 await page.goto(agentUrl('contacts'));
 await page.getByText('Add contact',{exact:true}).first().click();
 await page.getByLabel('Client name',{exact:true}).fill('Runtime client');
 await page.getByLabel('Email',{exact:true}).fill(prefix+'-client@example.com');
 await page.getByLabel('Private notes',{exact:true}).fill('RUNTIME-PRIVATE-NOTES');
 await clickSubmit('Add contact','/contacts');
 await page.getByRole('heading',{name:'Runtime client',exact:true}).waitFor();
 report.checks.push('Browser: create private contact');
 await page.goto(agentUrl('opportunities'));
 await page.getByText('Create opportunity',{exact:true}).first().click();
 await page.getByLabel('Title',{exact:true}).fill('Runtime purchase');
 await page.getByLabel('Type',{exact:true}).selectOption('purchase');
 await clickSubmit('Create opportunity','/opportunities');
 await page.getByRole('heading',{name:'Runtime purchase',exact:true}).waitFor();
 const intro=await db.agentIntroduction.findFirstOrThrow({where:{workspaceId:workspace}});
 const unauthorized=await clientCtx.request.post(api('stage'),{data:{introductionId:intro.id,stage:'qualified'}});
 assert.equal(unauthorized.status(),401);
 await post(otherCtx,origin+'/api/agent/'+otherOrg.crmWorkspace.id+'/stage',{introductionId:intro.id,stage:'qualified'},404);
 await post(agentCtx,api('stage'),{introductionId:intro.id,stage:'qualified'},403,{Origin:'https://untrusted.example'});
 report.checks.push('HTTP: unauthenticated, cross-agency and cross-origin mutations denied');
 await page.goto(agentUrl('offers'));
 await page.getByText('Prepare client quote',{exact:true}).first().click();
 await page.getByLabel('Property offering',{exact:true}).selectOption(offering.id);
 await page.getByLabel('Title',{exact:true}).fill('Runtime client quotation');
 await page.getByLabel('Property price / rental amount, THB',{exact:true}).fill('125000000.00');
 await page.getByLabel('Client fees, THB',{exact:true}).fill('100.00');
 await page.getByLabel('Deposit (separate), THB',{exact:true}).fill('10000.00');
 await page.getByLabel('Terms, dates and inclusions',{exact:true}).fill('Test quotation: subject to confirmation and contract.');
 const expiry=new Date(Date.now()+86400000).toISOString().slice(0,16);
 await page.getByLabel('Valid until',{exact:true}).fill(expiry);
 const draft=await clickSubmit('Prepare client quote','/quotes');
 await post(agentCtx,api('shares'),{id:draft.id},409);
 await page.getByRole('button',{name:'Request quote review',exact:true}).waitFor();
 await clickSubmit('Request quote review','/submit-quote');
 await post(adminCtx,origin+'/api/admin/agent-partners',{action:'approve-quote',id:draft.id});
 await page.reload();
 await page.getByRole('button',{name:'Create share link',exact:true}).waitFor();
 const share=await clickSubmit('Create share link','/shares');
 await page.getByRole('link',{name:'Open WhatsApp',exact:true}).waitFor();
 const whatsapp=await page.getByRole('link',{name:'Open WhatsApp',exact:true}).getAttribute('href');
 const telegram=await page.getByRole('link',{name:'Open Telegram',exact:true}).getAttribute('href');
 assert.equal(new URL(telegram).searchParams.get('url'),origin+share.path);
 assert(new URL(whatsapp).searchParams.get('text').includes(origin+share.path));
 await page.screenshot({path:'artifacts/agent/agent-offers-desktop.png',fullPage:true});
 report.screenshots.push('agent-offers-desktop.png');
 const clientPage=await clientCtx.newPage();
 await clientPage.goto(origin+share.path);
 await clientPage.getByRole('heading',{name:'Runtime client quotation',exact:true}).waitFor();
 const clientHtml=await clientPage.content();
 for(const secret of ['RUNTIME-PRIVATE-NOTES',prefix+'-client@example.com','commissionRate']) assert(!clientHtml.includes(secret),'Private quote data leaked');
 await clientPage.screenshot({path:'artifacts/agent/client-quote.png',fullPage:true});
 report.screenshots.push('client-quote.png');
 report.checks.push('Browser: draft, submit, approve, share, messenger compose and private client view');
 await page.goto(agentUrl('opportunities'));
 await page.getByText('Ask MyUNO to coordinate',{exact:true}).first().click();
 await page.getByLabel('What should MyUNO handle?',{exact:true}).fill('Prepare contracts and admin documents.');
 await page.getByLabel("I have the client's permission",{exact:false}).check();
 await clickSubmit('Ask MyUNO to coordinate','/handovers');
 const adminPage=await adminCtx.newPage();
 await adminPage.goto(origin+'/app/admin/agent-partners');
 await adminPage.getByRole('heading',{name:'Runtime purchase',exact:true}).waitFor();
 assert(!(await adminPage.content()).includes('RUNTIME-PRIVATE-NOTES'));
 await adminPage.screenshot({path:'artifacts/agent/myuno-coordination.png',fullPage:true});
 report.screenshots.push('myuno-coordination.png');
 const internal=await adminCtx.request.get(origin+'/api/crm/opportunities');
 assert.equal(internal.status(),200);
 const sharedInternal=await internal.text();
 assert(sharedInternal.includes('Runtime purchase'));
 assert(!sharedInternal.includes('RUNTIME-PRIVATE-NOTES'));
 report.checks.push('Browser/HTTP: explicit handover receipt, coordinator queue and legacy CRM isolation');
 await page.setViewportSize({width:390,height:844});
 await page.goto(agentUrl('home'));
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Mobile page overflows viewport');
 await page.screenshot({path:'artifacts/agent/agent-home-mobile.png',fullPage:true});
 report.screenshots.push('agent-home-mobile.png');
 const membership=await db.organizationMembership.findFirstOrThrow({where:{identityId:agent.id,organizationId:org.id}});
 await post(adminCtx,origin+'/api/admin/agent-partners',{action:'revoke-member',id:membership.id});
 await post(agentCtx,api('stage'),{introductionId:intro.id,stage:'qualified'},404);
 assert.equal((await clientCtx.request.get(origin+share.path)).status(),404);
 report.checks.push('Runtime: revoked membership denies mutations and invalidates client share');
 assert.deepEqual(report.browserErrors,[],'Browser runtime errors');
 report.result='passed';
 console.log('Agent portal production browser verification passed: '+report.checks.length+' flows');
} catch(error) {
 report.result='failed';report.error=String(error);
 console.error(error);
 process.exitCode=1;
} finally {
 await writeFile('artifacts/agent/verification.json',JSON.stringify(report,null,2));
 await writeFile('artifacts/agent/server.log',serverLogs.join(''));
 if(browser) await browser.close();
 if(server) server.kill('SIGTERM');
 await db.$disconnect();
}
