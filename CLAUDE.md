# CLAUDE.md — myUNO agent entry point

## Обязательный контекст

Репозиторий `pavel949/myUNO-final`; текущий гид [README](README.md), [SYSTEM](docs/current/SYSTEM.md), [IMPLEMENTATION_STATUS](docs/current/IMPLEMENTATION_STATUS.md), [REFERENCE](docs/current/REFERENCE.md). Target requirements: [PROJECT](PROJECT.md), [canonical](docs/canonical/README.md), [AI_AGENT_RULES](docs/canonical/AI_AGENT_RULES.md). Правила vendor-neutral и одинаковы для всех агентов.

Supabase app target ref `burcnghheyzbzffzgmjz`; другие проекты не подменять. Deployment только Vercel, известный alias my-uno-final.vercel.app; фактический deployed SHA проверять. Git auto-deploy в vercel.json сейчас выключен. Install/build не запускают migrations/repair.

## Рабочий процесс

Inspect main/open PRs/schema/services/guards/tests → reconcile с текущим статусом → implement согласованный vertical slice → safely migrate при необходимости → test → deploy/runtime verify в разрешённом контуре → update docs/evidence. Для документационной задачи не запускать production mutation/deploy без необходимости.

Не считать target spec, branch report, schema model, test file или зелёную сборку доказательством рабочего production процесса. Не объявлять непроверенный capability «готовым».

## Правила реализации

- В physical inventory один Unit; общие Booking/BlockedDate/pricing writers, никакого теневого календаря.
- Сервер считает money в целых satang; historical terms/snapshots сохраняются, ledger append-only.
- Identity общая, видимость scoped. Server guards/queries проверяют роли, org/project/unit/provider/space и effective capabilities.
- Public gallery и private passports/receipts/deal evidence имеют разные правила доступа.
- Config/ContentKey вместо вымышленных бизнес-условий и новых UI literals; RU/EN/TH/ZH coverage проверять отдельно.
- No production db push, automatic history repair, wholesale schema imports или demo seed.
- Реальные сроки, ставки, legal authority, ownership, supply, consent и delivery не придумывать.
- Вопросы founder нужны для подлинных коммерческих/юридических/необратимых решений; routine engineering выполнять самостоятельно в рамках задачи.

## Проверки и документы

[CONTRIBUTING](CONTRIBUTING.md), [Security](SECURITY.md), [OPERATIONS](docs/current/OPERATIONS.md), [DOCS_POLICY](docs/current/DOCS_POLICY.md). Каждый feature PR обновляет status/system/module README и генерируемый reference. Известные gaps не реализовывать повторно по старому «already fixed» без сверки текущих исходников.

Для whole-platform assessment дополнительно [audit contract](docs/audits/AI_FULL_PLATFORM_AUDIT.md), [flow matrix](docs/audits/AI_FLOW_SURFACE_MATRIX.md), `npm run audit:inventory`. Это discovery, не runtime evidence.
