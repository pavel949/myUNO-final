# Платёжные adapters

Актуально 2026-10-16. Implemented provider keys: `mock`, `opn`. `mock` отказывается работать в production; неизвестный provider не подменяется mock. Cash и bank transfer учитываются отдельными domain services, без внешнего processing.

Opn adapter существует: checkout/charge, re-fetch event/facts, refund. Настройки OMISE_* и merchant account/реальный charge/refund требуют проверки. Webhook body не считается доказательством поступления денег; следовать processOpnEvent и adapter, не выдумывать подпись.

[Код](index.ts) · [Opn](opn.ts) · [Finance](../README.md) · [Readiness mismatch](../../../../docs/current/IMPLEMENTATION_STATUS.md). Документация не подтверждает включённый provider в production.
