# Production readiness — проверенная оценка

Дата сверки: 16 октября 2026. Оценка основана на исходниках, изолированных PostgreSQL/Chromium проверках, read-only production SQL, Vercel metadata и фактической проверке media upload. [План достижения9/10](PRODUCTION_READINESS_PLAN.md) содержит критерии, задачи и acceptance; [реализовано/остаток](IMPLEMENTATION_STATUS.md) описывает функциональность. Canonical specification — целевые требования, а не доказательство реализации.

## Оценка по прежней шкале

| Контур | До исправлений | После проверенных пакетов | Основание |
|---|---:|---:|---|
| Техническая готовность кода |7/10|**8.5/10**| Исправлены финансовые границы/гонки, launch/content gates, lifecycle услуг, private polling и durable notification delivery; полный CI и Chromium passed |
| Фактическая готовность production |5/10|**5/10**| Live всё ещё обслуживает старую ревизию; миграция и полный release acceptance не завершены |

Это инженерная оценка, а не процент покрытия, реализованных функций или вероятность отсутствия дефектов. Цель9/10 требует >=90 подтверждённых weighted points по плану и отсутствия критических провалов денег, приватности, инвентаря, восстановления и обязательного рабочего процесса. Merge и green CI не заменяют deployed acceptance.

## Что исправлено и проверено

| Пакет | Результат | Оценка после пакета |
|---|---|---|
| [PR294](https://github.com/pavel949/myUNO-final/pull/294) | Согласованные Opn/Blob/scheduler launch gates; content review fail-closed; даты в statement fingerprint; serialized confirm/dispute/auto-close услуг; отбрасывание stale private responses после revoke; durable post-commit delivery; payout locks/overlap/refund safety | Код7→8→8.5; production5 |
| [PR295](https://github.com/pavel949/myUNO-final/pull/295) | Оплаченная отмена, пересекающая границу отчёта, блокирует generation/unsigned sign-off до allocation; unpaid/deposit-only/failed исключения не блокируют ошибочно; подписанная история неизменна. Восемь новых DB regressions. Реальная загрузка в существующий QA draft | Код8.5; production5 |
| [PR296](https://github.com/pavel949/myUNO-final/pull/296) | Protected read-only preflight: READ ONLY до ledger query, exact-main push CI, безопасные фиксированные категории ошибок без driver text/URI/SQL; backup и migrate пропускаются при preflight_only | Код8.5; production5 |
| [PR297](https://github.com/pavel949/myUNO-final/pull/297) | Безопасный выбор hostname из проверенного backup-подключения, сохранение migration credentials/TLS; public-schema guard. До successful CI и runner acceptance это подготовленное исправление, не доказательство успешной миграции | Код8.5; production5 |

Проверенный application codeRevision: `c61412e71801e345fb7d3cde0168a6631b0b4932`. Ops/docs commits не меняют application revision; exact checkout inventory — [REFERENCE](REFERENCE.md).

## Проверки

- Final PR295 head71f3589a: [CI38928840349](https://github.com/pavel949/myUNO-final/actions/runs/38928840349) — **6005 tests,554 test files**, lint, TypeScript, build passed. [Chromium38928840417](https://github.com/pavel949/myUNO-final/actions/runs/38928840417) passed. Main1ffa40f6: [push CI38930745531](https://github.com/pavel949/myUNO-final/actions/runs/38930745531) passed.
- PR296 headc367d2d7: [CI38934565869](https://github.com/pavel949/myUNO-final/actions/runs/38934565869), [Chromium38934566002](https://github.com/pavel949/myUNO-final/actions/runs/38934566002) passed. Main0286152c: [push CI38934839721](https://github.com/pavel949/myUNO-final/actions/runs/38934839721) passed, включая6005 application tests и11 отдельных policy/preflight checks. Перекрывающиеся targeted suites не суммируются.
- PR297 локально:12 policy/preflight checks, targeted ESLint, YAML parse, generated reference и repository docs consistency passed. [CI38938380150](https://github.com/pavel949/myUNO-final/actions/runs/38938380150) passed6005 tests/554 files, lint/typecheck/build; [Chromium38938380129](https://github.com/pavel949/myUNO-final/actions/runs/38938380129) passed. Main53634204: [push CI38938574085](https://github.com/pavel949/myUNO-final/actions/runs/38938574085) полностью passed.
- Backup/restore: [release38925087403](https://github.com/pavel949/myUNO-final/actions/runs/38925087403) и [release38932599598](https://github.com/pavel949/myUNO-final/actions/runs/38932599598) восстановили и сверили **120 application tables**. Последующий migrate в обоих случаях остановился на ledger_read до DDL. Backup не является successful migration.
- [Read-only configured preflight38936441214](https://github.com/pavel949/myUNO-final/actions/runs/38936441214): aws-1 session endpoint, P1001/network_unreachable. [Alternate38936756732](https://github.com/pavel949/myUNO-final/actions/runs/38936756732): aws-0, initialization/unclassified. SQL миграций не исполнялся, backup/migrate skipped. Это диагностические результаты, не исправленная connectivity.
- [Live media acceptance](../evidence/readiness-20261016/PRODUCTION_MEDIA_ACCEPTANCE.md): реальный admin upload9978bytes/960×640 → BlobHTTP200 → MediaAsset и связь с существующим draft → reload и совпадающийSHA256. Старое cover сохранено, draft не опубликован. Проверка относится к старому deployedSHA; oversized negative attempt не изменил gallery, но точный server limit этим не доказан.

## Последняя production-проверка —17:32UTC

[Read-only preflight38940368573](https://github.com/pavel949/myUNO-final/actions/runs/38940368573), exact main53634204: reviewed-main и protected route metadata passed; backup endpoint оказался тем же aws-1-ap-south-1.pooler.supabase.com:5432. С сохранённым DATABASE_URL credential preflight получил **P1001 / PrismaClientInitializationError / network_unreachable** на ledger_read. Backup и migrate **skipped**, DDL не запускался. Изменения target/schema/host policy проверены, но успешность migration connectivity не подтверждена. Это не доказательство неверного пароля: точная причина всё ещё не установлена. Требуется проверить доступность/auth/TLS действующего migration connection в защищённом контуре; секреты из Vercel не извлекались, пароль не сбрасывался. Повторный запуск без изменения подтверждённой причины не является исправлением.

После этого набора и всех перечисленных проверок оценка остаётся **код8.5/10, production5/10**. Реальный restore и admin upload уменьшают неопределённость, но отсутствие нового deployedSHA и незавершённые обязательные acceptance не позволяют повысить runtime score.

## Что забирает основные баллы

| Приоритет | Факт / недостающее доказательство | Необходимое завершение |
|---|---|---|
| P1: release | Alias my-uno-final.vercel.app → deployment dpl_4hoKajzkxCMc1nRrp5LKzoBmSW7v → source408ad99abfae9e7e67b6f518a736b751d72a7283; новые исправления не обслуживаются | Successful protected migration, затем проверенный Vercel deploy, authenticated runtime acceptance и сверка alias SHA |
| P1: database | Production ledger100 finished/0unfinished; две ожидаемые pending:20261015080331_pricing_editor_role и20261015120347_property_capability_delegation | Working runner connection, exact-SHA backup/restore, checksum policy, migration, financial parity. Без repair истории или прямого обхода workflow |
| P1: content |4213 needs_review,8716 ok translations | Содержательное review локалей/required keys. Не blanket approval и не bypass buildgate |
| P1: automation | [Scheduled38920535596](https://github.com/pavel949/myUNO-final/actions/runs/38920535596) в15:01UTC успешно вызвал3 frequent jobs | Устойчивая серия именно scheduled ticks, свежесть каждого JobRun и подтверждённые alerts; один запуск не доказывает cadence5min |
| P1: внешние системы | Blob upload доказан для adminQA/старого build. Реальные email acknowledgements, card charge/refund, private/cross-scope media acceptance не доказаны; отсутствие ключей не равно working provider | Приёмка на новом deployedSHA и разрешённых test fixtures, без реальных списаний/рассылок или фальшивого business ledger |
| P1: операции | Полная live цепочка PMS→расход/receipt→statement→sign-off/payout, cross-scope/revoke не подтверждена | Сквозная приёмка с действительными полномочиями и данными; не вымышленные оплаты/ownership/документы |
| P1: незавершённые протоколы | BookingReschedule replacement hold/funding/atomic commit/expiry; ServiceQuoteVersion acceptance→order; полная allocation-модель поздних provider refunds | Законченные vertical slices с race/expiry/late-payment/revision/UI acceptance. Manual quote fallback и fail-closed ambiguous payouts описываются честно |

Юридические основания, authority, licences и12 draft objects не подтверждаются автоматически кодом и не публикуются ради score. HealthHTTP200/dbok подтверждает reachability приложения, но не release completeness или работоспособность providers. Vercel — единственная платформа deployment; Git auto-deploy отключён.

Повысить production до9/10 сейчас оснований нет. Следующая оценка меняется только вместе с проверяемым результатом соответствующего release/операционного acceptance.
