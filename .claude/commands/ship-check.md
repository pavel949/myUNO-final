---
description: Definition-of-done check — is this change live for a real user, and did it move the loop?
---

Run this at the end of every task. Report a table, PASS / FAIL / NOT CHECKED per line, no prose padding.

1. **Merged** — the commit is on `main` (`git log origin/main --oneline -5`).
2. **Deployed** — latest Vercel production deployment for `my-uno-final` is READY and built from that SHA.
3. **Reachable** — the changed page/route loads for an anonymous visitor (not behind Vercel SSO, not 401/403). If production is still SSO-protected, this line is FAIL, not NOT CHECKED.
4. **Advisors** — Supabase security + performance advisors for `burcnghheyzbzffzgmjz`: count before vs after. Any new WARN/ERROR is FAIL.
5. **Migration ledger** — every folder in `prisma/migrations` has a finished row in `_prisma_migrations` (read-only `select migration_name from _prisma_migrations`). Any gap is FAIL.
6. **Loop metric** — read-only counts from production: `unit` live, `management_contract`, `booking`, `payment`, `service_order`, `buyer_signal`. State which one this change is meant to move. If the answer is "none", say so plainly in one line.

Close with: **Shipped:** … · **Not shipped:** … · **Next single task:** …
