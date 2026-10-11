# Хунки для зарезервированных / общих файлов (не входят в основной патч)

## `src/modules/content/seed.ts` (зарезервирован, Приложение A)

```diff
+import { EXPENSE_SAFETY_KEYS } from './expense-safety.seed';
 ...
-  ...HOMEPAGE_V4_KEYS, ...PROPERTY_FACT_KEYS, ...AUDIT_FIX_KEYS];
+  ...HOMEPAGE_V4_KEYS, ...PROPERTY_FACT_KEYS, ...AUDIT_FIX_KEYS, ...EXPENSE_SAFETY_KEYS];
```

Без хунка ключи есть в репозитории (`expense-safety.seed.ts`, их видит тест `content-keys-seeded`),
но не попадут в БД при посеве; страницы покажут английские значения по умолчанию.
Все ключи — `needs_review`, посев на production не выполнялся.

## `scripts/db-verify.mjs` (общий скрипт)

```diff
   'operational_task',
+  'expense_receipt',
 ];
```

Закрытие Data API для `expense_receipt` уже проверено тестом
`manual-cost-statement.integration.test.ts` («the receipt table is closed to the Data API»);
хунк переносит ту же проверку в общий гейт.

## `src/modules/projects/ownership.service.ts` — см. `03-external-hunk-ownership-service.patch`
