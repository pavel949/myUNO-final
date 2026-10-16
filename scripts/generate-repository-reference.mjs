#!/usr/bin/env node
/** Filesystem-only documentation; never reads .env values or connects to services. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { inventory } from './audit-platform-inventory.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');
let mismatch = false;
function write(p, value) {
  const file = path.join(root, p);
  if (checkOnly) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== value) {
      console.error(`${p} is stale; regenerate repository reference.`);
      mismatch = true;
    }
  } else fs.writeFileSync(file, value);
}
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const link = p => `[${p}](<../../${p}>)`;
const walk = p => fs.readdirSync(path.join(root,p),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(e=>e.isDirectory()?walk(`${p}/${e.name}`):[`${p}/${e.name}`]);
const inv = inventory(root);
const codeRevision = execFileSync('git', ['log','-1','--format=%H','--',':(glob)src/**/*.ts',':(glob)src/**/*.tsx','prisma/schema.prisma','prisma/migrations','package.json','package-lock.json','next.config.js','vercel.json'],{cwd:root,encoding:'utf8'}).trim();
const snapshot = { codeRevision, ...inv };
if (!checkOnly) fs.mkdirSync(path.join(root,'docs/current'),{recursive:true});
write('docs/current/inventory.json', JSON.stringify(snapshot,null,2)+'\n');
let out = `# Полный справочник исходников\n\nСгенерировано \`node scripts/generate-repository-reference.mjs\`. Последняя ревизия исполняемого кода: \`${codeRevision}\`. Содержимое соответствует текущему checkout; uncommitted изменения также входят в discovery.\n\nЭто статический справочник: файлы/exports/маршруты/модели/переменные. Не доказывает достижимость, права, production deploy, применение миграций или прохождение тестов. Handlers могут дополнительно экспортировать методы через re-export; для точного contract читать source.\n\n[Система](SYSTEM.md) · [Статус](IMPLEMENTATION_STATUS.md) · [JSON inventory](inventory.json)\n\n## Количества\n\n| Объект | Количество |\n|---|---:|\n`;
for (const [k,v] of Object.entries(inv.summary)) out+=`| ${k} | ${v} |\n`;
out+='\n21 module directories включают workflows (integration tests). src/modules/global-desks.ts — общий helper, отдельным модулем не считается.\n\n## Все страницы\n\nURL с [id]/[slug] — шаблон. Route groups исключены из URL. Redirects в next.config.js читать отдельно.\n\n| URL | Область discovery | Источник |\n|---|---|---|\n';
for (const r of inv.routes.filter(r=>r.kind==='page')) out+=`| \`${r.path}\` | ${r.area} | ${link(r.source)} |\n`;
out+='\n## Все route handlers\n\nЭто индекс методов/исходников, не OpenAPI spec. Payload, validation, auth/scope, DTO и ошибки определяются соответствующим route и вызываемым сервисом; названия URL не гарантируют access. Не вызывать mutating endpoints для проверки документации.\n\n| URL | Явно экспортированные методы | Источник |\n|---|---|---|\n';
for (const r of inv.routes.filter(r=>r.kind==='handler')) {
 const text=read(r.source);const methods=[...text.matchAll(/export\s+(?:(?:async\s+)?function|const)\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/g)].map(m=>m[1]);
 out+=`| \`${r.path}\` | ${[...new Set(methods)].join(', ')||'см. source/re-export'} | ${link(r.source)} |\n`;
}
out+='\n## Все модули: runtime, exports и тесты\n\nExports перечислены синтаксически, без вывода о callable reachability. Index/barrel files также перечислены. Seed/fixture отмечены отдельно; полный тестовый список ниже.\n';
for (const m of inv.modules) {
 out+=`\n<a id="module-${m.name}"></a>\n\n### ${m.name}\n\nФайлов: ${m.files}; тестовых файлов: ${m.testFiles}. [Описание](../../src/modules/${m.name}/README.md).\n\n| Исходник | Вид | Named declarations |\n|---|---|---|\n`;
 for (const f of walk(`src/modules/${m.name}`).filter(f=>/\.[cm]?[jt]sx?$/.test(f)&&! /\.(test|spec)\./.test(f))) {
  const t=read(f);const exports=[...t.matchAll(/export\s+(?:default\s+)?(?:(?:async\s+)?function|const|class|enum)\s+([A-Za-z_$][\w$]*)/g)].map(x=>x[1]);
  const kind=/seed/.test(f)?'seed':/test-support/.test(f)?'test support':/\/index\./.test(f)?'barrel':'implementation';
  out+=`| ${link(f)} | ${kind} | ${exports.map(x=>'`'+x+'`').join(', ')||'см. исходник'} |\n`;
 }
}
out+='\n## Shared helpers, components и route-local orchestration\n\nПомимо modules, реализация находится в app/actions, app/libs, lib, jobs и components. Source links позволяют сверить каждую поверхность с конкретным компонентом.\n\n';
for(const dir of ['src/lib','src/jobs','src/app/actions','src/app/libs','src/components']){
 out+=`\n### ${dir}\n\n`;
 for (const f of walk(dir).filter(f=>/\.[cm]?[jt]sx?$/.test(f)&&!/\.(test|spec)\./.test(f)))out+=`- ${link(f)}\n`;
}
const schema=read('prisma/schema.prisma');
out+='\n## Все модели и enum values\n\nSource: '+link('prisma/schema.prisma')+'. Ни одна модель автоматически не считается реализованным user journey. Scalar/relation/default/index/mapping definitions ниже воспроизводятся из schema; SQL constraints и triggers находятся в migrations.\n\n';
for(const m of schema.matchAll(/^(model|enum)\s+(\w+)\s*\{([\s\S]*?)^\}/gm))out+=`### ${m[1]} ${m[2]}\n\n\`\`\`prisma\n${m[0]}\n\`\`\`\n\n`;
out+='## Все миграции\n\nНаличие файла не доказывает production application. Не править исторические SQL; apply/reconcile отдельно.\n\n';
for(const f of inv.migrations)out+=`- ${link(f)}\n`;
out+='\n<a id="environment"></a>\n\n## Переменные окружения: только имена и consumers\n\nЗначения, .env и credentials не читаются и не включаются. Список найден статически в app/scripts/workflows и .env.example; computed keys и внешние platform settings требуют ручной сверки. Наличие имени не означает обязательность или корректную config. VERCEL_* — также platform-provided metadata.\n\n| Имя | Consumers |\n|---|---|\n';
const env = new Map();
const addEnv=(key,f)=>{if(!env.has(key))env.set(key,new Set());env.get(key).add(f);};
for(const f of [...walk('src'),...walk('scripts'),...walk('.github/workflows'),'.env.example','next.config.js']){
 if(!/\.(?:[cm]?[jt]sx?|ya?ml)$/.test(f)&&f!=='.env.example')continue;
 if(/\.(test|spec)\.|test-support/.test(f))continue;
 const t=read(f);
 for(const m of t.matchAll(/\b(?:process\.env|env)\s*(?:\.([A-Z][A-Z0-9_]+)|\[\s*['"]([A-Z][A-Z0-9_]+)['"]\s*\])/g))addEnv(m[1]||m[2],f);
 for(const m of t.matchAll(/\b(?:secrets|vars)\.([A-Z][A-Z0-9_]+)/g))addEnv(m[1],f);
 if(f==='.env.example')for(const m of t.matchAll(/^([A-Z][A-Z0-9_]+)=/gm))addEnv(m[1],f);
}
for(const [k,v] of [...env].sort((a,b)=>a[0].localeCompare(b[0],'en')))out+=`| \`${k}\` | ${[...v].map(link).join(', ')} |\n`;
out+='\n## Все тестовые файлы\n\nЭто список файлов, не результат запуска. Дополнительные node:test suites лежат в scripts и вызываются CI.\n\n';
for(const f of inv.tests)out+=`- ${link(f)}\n`;
out+='\n## Workflows и build sources\n\n';
for(const f of [...walk('.github/workflows'),'package.json','package-lock.json','vercel.json','next.config.js','tsconfig.production.json','vitest.config.ts','.env.example'])out+=`- ${link(f)}\n`;
write('docs/current/REFERENCE.md',out);
if (mismatch) process.exitCode = 1;
console.log(JSON.stringify({codeRevision,summary:inv.summary,environmentNames:env.size}));
