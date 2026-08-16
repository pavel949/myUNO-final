# T-042 · Hardening pass — evidenced checklist

Each item below is either **verified** (with the evidence that proves it) or
**not verified** (with the reason). Nothing is ticked on the strength of code
existing; a header that is set but never asserted is a header that silently
stops being set.

Specs: doc 12 (security & privacy) · doc 06 §5 (accessibility & quality bar).

---

## 1. Rate limits

| Endpoint | Limited | Evidence |
|---|---|---|
| `POST /api/auth/login` | ✅ | `src/app/libs/rateLimit.ts` via `checkRateLimit('login:…')` |
| `POST /api/auth/register` | ✅ | per-IP key in `register/route.ts` |
| `POST /api/auth/forgot-password` | ✅ | per-IP + per-account keys |
| `POST /api/auth/guest-access` | ✅ | per-IP key |
| `POST /api/pricing/breakdown` | ✅ | per-IP key |
| `POST /api/leads` | ✅ **added in this pass** | `leads-rate-limit.integration.test.ts` |

**Found and fixed:** `/api/leads` was unauthenticated, opened a thread and sent
an N-29 alert to *every* admin on success, and had no limit. One script could
have buried the founder's inbox and the real enquiries inside it. The honeypot
already there stops naive bots; it does nothing against a determined one.

Evidence: 4 tests — an ordinary submission passes, a sixth from the same
address gets `429` with a `Retry-After`, a second visitor is unaffected by the
first one's flood, and a blocked request writes no thread.

**Known limit, deliberate:** the limiter is in-process (`Map`). On a
multi-instance deploy each instance counts separately. The file says so and
names Redis as the swap. Acceptable for a single-instance launch; revisit
before scaling out.

## 2. Headers / CSP

Verified by `src/middleware.test.ts` (9 tests), asserting on the response the
middleware actually returns:

- `X-Frame-Options: DENY` **and** `frame-ancestors 'none'` — clickjacking closed at both levers.
- `default-src 'self'`, `base-uri 'self'`, `connect-src 'self'`.
- `form-action 'self'` — a form that can post anywhere is an exfiltration route for anything a guest types, passport details included.
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy` denies geolocation, microphone, camera, payment and four more.
- The same headers are asserted on an authenticated path (`/owner`), not only on the marketing pages.

**Known limit, documented in the middleware:** `script-src` and `style-src`
carry `'unsafe-inline'`. Next's App Router hydrates through inline scripts and
Tailwind emits inline styles; removing it needs Next's nonce plumbing. Called
out at the point of use rather than hidden.

## 3. Error-page unification

Verified by inspection: `src/app/error.tsx` and `src/app/not-found.tsx` at the
root, plus per-surface boundaries for `/ops`, `/mc`, `/owner` and the admin
panel, so a failure inside one portal does not blank the whole app.

**Not verified:** there is no `global-error.tsx`, so an error thrown *in the
root layout itself* falls back to Next's default page. Narrow case, but it is
the one place the branded error page would not appear.

## 4. Load sanity on search / booking

**Not verified.** Honest gap: meaningful load numbers need a deployed
environment with representative data and a load generator, neither of which
exists in this session. What *is* verified is the shape that governs
behaviour under load — search and availability queries are indexed on the
columns they filter (`prisma/schema.prisma`), and the booking path recomputes
totals server-side rather than trusting the client. Recommend running this
against the Vercel preview before launch, and treating it as a T-043 gate.

## 5. Accessibility (doc 06 §5)

| Requirement | Status | Evidence |
|---|---|---|
| `lang` per locale | ✅ | `<html lang={locale}>` in `src/app/layout.tsx` |
| Focus-visible on everything interactive | ✅ **fixed in this pass** | global `:focus-visible` rule in `globals.css` |
| Reduced motion respected | ✅ **fixed in this pass** | `@media (prefers-reduced-motion: reduce)` in `globals.css` |
| Form errors announced | ◑ partial | `role="alert"` on the extension panel and several forms; not yet audited across every form |
| 44px minimum touch targets | ◑ partial | `h-48` inputs and `Button` sizes clear it; not measured across every control |
| AA contrast | ◑ partial | token pairings are pre-checked in doc 06 §2.1; not re-measured in the browser |
| Empty / loading / error states | ✅ | `EmptyState`, `LoadingState`, `ErrorState` in the design system, used across surfaces |

**Found and fixed:** nothing in the codebase respected
`prefers-reduced-motion`, and there was no global focus-visible rule — only
per-component focus styles, so anything that forgot one had no visible focus at
all. Both are doc 06 §5 requirements.

**Not verified:** the three ◑ rows need a browser and a screen reader. They are
checks against a running deployment, not against source, and should be a T-043
gate.

## 6. PII log scrub

Verified by a scan of every `console.*` call in `src/` against the PII field
names in doc 12, plus `src/middleware.test.ts` for the redaction helper.

**Three leaks found and fixed:**

1. **`src/modules/auth/email.ts`** — the console fallback printed the recipient
   address and the entire HTML body. These are *auth* emails: their bodies
   carry one-time reset and verification links, so anyone with log access held
   a working account takeover. Now logs the subject and a character count.
2. **`src/modules/comms/email.seam.ts`** — the dev-mode fallback dumped `to`,
   `body` and `htmlBody` as a structured object. Now logs a redacted address
   (`a***@example.com`) and lengths. Doc 12 admits no dev-mode exception:
   staging logs are shipped and retained like any other.
3. **`src/modules/integrations/messenger.ts`** — the stub adapter printed the
   recipient and the full message on every send (fixed under T-040; retested
   here).

Remaining `console.error` calls log identity UUIDs and error messages, not
personal data — pseudonymous identifiers are what an audit trail is made of.

---

## Summary

**Fixed in this pass:** an unlimited public lead endpoint, two PII log leaks,
no reduced-motion support, no global focus-visible rule.

**Verified with tests:** 13 (9 headers + redaction, 4 lead rate limiting).

**Left open, deliberately, for T-043:** load testing, the browser-and-screen-
reader half of the accessibility audit, `global-error.tsx`, and swapping the
in-process rate limiter for Redis if the deploy goes multi-instance.
