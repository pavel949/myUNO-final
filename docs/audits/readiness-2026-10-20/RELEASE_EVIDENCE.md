# Release evidence

| Check | Result | Evidence |
|---|---|---|
| Current main SHA | Verified | GitHub commits/main agrees with local HEAD; BASELINE.md |
| Local lint | Pass | lint.log |
| Prisma generation | Pass | npm run build generation stage; build.log |
| Production TypeScript | Pass after generation | typecheck.log (empty, exit 0) |
| Focused unit/mock tests | 13 files / 93 tests pass | focused-tests.log |
| Migration/content/backup/isolation policies | 44 pass | policies.log |
| Full local suite | Not completed, environment/setup limited | No running local PostgreSQL; interrupted; not scored as application failures |
| Standard local build | Blocked by intended production bypass refusal | build.log |
| Exact-main CI | Success | https://github.com/pavel949/myUNO-final/actions/runs/39269830286 ; job steps confirm migrations, drift, restore rehearsal, full tests, TypeScript, build |
| Isolated browser CI | Success on docs-only PR314 SHA 6abbd930 | https://github.com/pavel949/myUNO-final/actions/runs/39275766415 ; not production runtime proof |
| Exact-main production backup | Success | https://github.com/pavel949/myUNO-final/actions/runs/39341998178 ; dump, scratch restore/table parity, encryption, artifact storage steps succeeded |
| Main production dependency audit | 0 known vulnerabilities | audit-production.json |
| Live deployment source dependency audit | 2 critical / 1 high vulnerable packages | deployed-audit.json ; audit performed on exact source lockfile in temporary directory, not installed production artifact |
| Served source SHA | Older 8bb999a6 | Vercel connected deployment metadata; BASELINE.md |
| Protected health / runtime error queries | Not checked: access denied | Vercel connector 403; no CLI installed |
| Production schema/data/permissions/provider acceptance | Not checked | No database or provider credentials configured in execution environment |

No cutover or sign-off performed. Release verdict is no certification of full readiness.
