# MANIFEST — расход → приватный чек → отчёт собственника → согласование

База: `main` 6a980f20a72e6e0e86599f1a5053ed10084e1846, tree e08e9523709391825fbcba01e16c86806ac06c4e (проверено 2026-10-11, рабочая копия была чистой). Не запушено, PR не создавался, не мержилось, production не затрагивался.

## SHA-256 пакета
```
f8bd8a2eb547fa687e093da8ab4d2e16362f3c61e6d054b58de01a7d568ec178  01-code-and-tests.patch
7b4ade4fd1b41cca64719663da17ddd4f9f54b0907b32267bdce6b645e23ff77  02-schema-and-migrations.patch
679eb9df7a7e5c2ec46009dd77e3aaec1ce64790f6f12cd3e2d0d30eee2a6882  03-external-hunk-ownership-service.patch
cf10a5d21fe13d6ccd9ad6b26ef30f99694b40089645d62940fde55bc0cdbeca  04-external-hunk-content-seed.md
```

Порядок применения: `02` (схема) → `01` (код и тесты) → хунки `03`, `04`, `05` (общие/зарезервированные файлы; решает координатор).

## Изменённые файлы (M) и новые (A) — патчи 01 и 02
```
A	prisma/migrations/20261010070000_manual_cost_integrity/migration.sql
A	prisma/migrations/20261010102000_private_expense_receipts/migration.sql
A	prisma/migrations/20261010103000_statement_snapshot_lines/migration.sql
M	prisma/schema.prisma
M	src/app/api/admin/ledger/[entryId]/reverse/route.ts
M	src/app/api/admin/statements/[statementId]/line-items/route.ts
M	src/app/api/admin/statements/[statementId]/sign-off/route.ts
M	src/app/api/admin/statements/generate/route.ts
A	src/app/api/ledger/receipts/[receiptId]/route.ts
A	src/app/api/ledger/receipts/route.ts
M	src/app/api/ledger/record-cost/record-cost.integration.test.ts
M	src/app/api/ledger/record-cost/route.ts
M	src/app/api/owner/statements/[statementId]/sign-off/route.ts
M	src/app/mc/costs/page.tsx
M	src/app/ops/costs/page.tsx
A	src/app/ops/costs/record-cost-client.test.tsx
M	src/app/ops/costs/record-cost-client.tsx
A	src/app/owner/statements/[statementId]/client.receipt.test.tsx
M	src/app/owner/statements/[statementId]/client.test.tsx
M	src/app/owner/statements/[statementId]/client.tsx
M	src/app/owner/statements/[statementId]/page.tsx
A	src/modules/content/expense-safety.seed.ts
A	src/modules/finance/expense-access.ts
A	src/modules/finance/expense-receipt-file.test.ts
A	src/modules/finance/expense-receipt-file.ts
A	src/modules/finance/expense-receipt-labels.ts
A	src/modules/finance/expense-receipt.service.ts
M	src/modules/finance/index.ts
M	src/modules/finance/ledger.service.ts
A	src/modules/finance/manual-cost-input.test.ts
A	src/modules/finance/manual-cost-input.ts
A	src/modules/finance/manual-cost-statement.integration.test.ts
A	src/modules/finance/manual-cost.service.ts
A	src/modules/finance/statement-expense.test.ts
A	src/modules/finance/statement-expense.ts
M	src/modules/finance/statement-signoff.service.ts
A	src/modules/finance/statement-snapshot.integration.test.ts
A	src/modules/finance/statement-snapshot.test.ts
A	src/modules/finance/statement-snapshot.ts
A	src/modules/workflows/expense-to-owner-report.integration.test.ts
```

Не входят: зависимости, `.env`, сборка, логи, чужие изменения. Ни одной зарезервированной (Приложение A) и общей (`package.json`, CI, `vercel.json`, tsconfig) правки в патчах нет.

Дополнительно: `e2e/` (сценарий Playwright, синтетический сид, результаты 19/19), `screenshots/` (только синтетические данные).
