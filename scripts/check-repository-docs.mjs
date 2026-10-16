#!/usr/bin/env node
/** Read-only documentation checks; no database, credentials or HTTP calls. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { inventory } from './audit-platform-inventory.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const walk = dir => fs.readdirSync(path.join(root,dir),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(e=>e.isDirectory()?walk(`${dir}/${e.name}`):[`${dir}/${e.name}`]);
const docs = [...walk('docs'),...walk('src/modules'),...fs.readdirSync(root).filter(f=>f.endsWith('.md'))].filter(f=>f.endsWith('.md'));
const failures=[];
let count=0;
const slug = heading => heading.toLowerCase().replace(/<[^>]*>/g,'').replace(/[^\p{L}\p{N}_\-\s]/gu,'').trim().replace(/ /g,'-');
function anchors(text) {
 const found = new Set();const duplicates = new Map();
 for(const m of text.matchAll(/^#{1,6}\s+(.+)$/gm)){
  const s=slug(m[1]);const n=duplicates.get(s)||0;duplicates.set(s,n+1);found.add(n?`${s}-${n}`:s);
 }
 for(const m of text.matchAll(/\b(?:id|name)=["']([^"']+)["']/g))found.add(m[1]);
 return found;
}
// Handles angle-wrapped destinations and balanced parentheses in App Router paths.
function destinations(text) {
 const result=[];
 for (const m of text.matchAll(/!?\[[^\]\n]*\]\(/g)) {
  let i=m.index+m[0].length;
  if(text[i]==='<'){const end=text.indexOf('>',i);if(end>=0)result.push(text.slice(i+1,end));continue;}
  let depth=1, value='';
  for(;i<text.length;i++){
   const c=text[i];if(c==='(')depth++;if(c===')'){depth--;if(!depth)break;}
   if(c==='\n')break;value+=c;
  }
  if(depth===0)result.push(value.split(/\s+["']/)[0]);
 }
 return result;
}
for(const file of docs){
 const original=fs.readFileSync(path.join(root,file),'utf8');
 if(/netl(?:ify|ix)/i.test(original))failures.push(`${file}: retired deployment provider mention`);
 const text=original.replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm,'');
 // Historical/reference documents retain old evidence, but all real local links must resolve.
 for(const dest of destinations(text)){
  if(!dest||/^[a-z][a-z0-9+.-]*:/i.test(dest)||dest.startsWith('//'))continue;
  // Design product URL samples and external site-root paths are not repository links.
  if(dest.startsWith('/'))continue;
  const [pathname,fragment]=dest.split('#');
  const target=path.resolve(path.dirname(path.join(root,file)),decodeURIComponent(pathname.split('?')[0]));
  if(!target.startsWith(root+path.sep)&&target!==root){failures.push(`${file}: link escapes repository: ${dest}`);continue;}
  if(!fs.existsSync(target)){failures.push(`${file}: missing local target: ${dest}`);continue;}
  count++;
  // Strict anchors for the active guide and module entry points only; historical sections vary.
  if(fragment && (file.startsWith('docs/current/')||file==='README.md'||file.startsWith('src/modules/')) && target.endsWith('.md')) {
   if(!anchors(fs.readFileSync(target,'utf8')).has(decodeURIComponent(fragment)))failures.push(`${file}: missing anchor: ${dest}`);
  }
 }
}
const saved=JSON.parse(fs.readFileSync(path.join(root,'docs/current/inventory.json'),'utf8'));
const { codeRevision, ...recorded }=saved;
if(!/^[0-9a-f]{40}$/.test(codeRevision))failures.push('inventory: missing audited code revision');
if(!isDeepStrictEqual(recorded,inventory(root)))failures.push('inventory is stale; run node scripts/generate-repository-reference.mjs');
for(const m of saved.modules)if(!fs.existsSync(path.join(root,`src/modules/${m.name}/README.md`)))failures.push(`missing README for ${m.name}`);
if(failures.length){for(const f of failures)console.error(f);console.error(`${failures.length} documentation error(s)`);process.exitCode=1;}
else console.log(`Documentation OK: ${docs.length} Markdown files, ${count} local links, ${saved.summary.pages} pages, ${saved.summary.handlers} handlers, ${saved.summary.modules} module directories; inventory matches checkout.`);
