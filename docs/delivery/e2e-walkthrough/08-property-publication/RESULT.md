# Process 8 — owner submits a property → admin review → draft → publication gates

> **Исторический отчёт / evidence прежнего среза.** Не является текущим статусом main или production. Актуальное [описание системы](../../../current/SYSTEM.md) и [реализация / остаток](../../../current/IMPLEMENTATION_STATUS.md) сверены 2026-10-16. Команды и результаты ниже относятся только к исходному контексту отчёта.

Local production build; browser as owner and admin.

| Step | Result |
|---|---|
| Owner wizard: property type, residence, home details, photos, offers & management, review, submit | PASS — `submitted` (no photos allowed at submit by design; checked at publication) |
| Area dropdown | FIXED — showed URL slugs ("bang-tao"); now translated names |
| Photo upload locally | NOT a product fault: sandbox has no Blob token. Prod checked: 636 photos in Vercel Blob, last upload 10 Oct |
| Admin "Property applications": checklist (identity, duplicates, photos) then "Create canonical draft" | PASS — draft unit created, nothing published, no owner assigned unless verified |
| Publication panel warning | FIXED — said "Production checkout is unverified and requires a separate database repair" (stale) |
| Go live without permitted-use confirmation | PASS — refused (400) |
| Draft unit hidden from public unit API and search | PASS |

Not covered in browser: the positive path (permitted use confirmed + photos + go live) — covered by `onboarding.integration.test.ts`; mobilization checklist; tariff editor.
Prod finding: 67 photos point to an old Supabase project (omwoglpcwaiflaprgrne) and 10 hotlink layantararesort.com — they should be copied into Blob.
