# Process 7 — website lead → CRM → admin pipeline → conversation

Local production build; browser as anonymous visitor and admin.

| Step | Result |
|---|---|
| Owners page lead form: consent required before send | PASS |
| Send lead with campaign parameters | PASS — thank-you shown |
| CRM profile (prospect), management opportunity, activity, attribution touch, private thread created | PASS |
| Consent recorded in the PDPA journal | FIXED — only "Consent: yes" text in the thread; now an append-only `crm_consent` row (service / website), no duplicate if already granted |
| Contact (e-mail/phone) kept out of `identity` (anti-hijack) | PASS — by design, in the thread text only |
| Admin sees the lead in /app/admin/crm, moves it to Qualified (logged) | PASS |
| Admin inbox shows the lead thread; admin notified | PASS |

Found, not fixed: `id="lead-form"` appears twice on /owners, /developers, /buyers, /management-companies (wrapper div + inner section) — duplicate id.
