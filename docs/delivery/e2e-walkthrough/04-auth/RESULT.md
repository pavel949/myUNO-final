# Process 4 — register, verify e-mail, log in/out, forgot/reset password, access boundaries

Local production build; real browser. E-mail delivery cannot be exercised here (no mail key in the sandbox) — one-time tokens were minted in the test database, then used through the real pages.

| Step | Result |
|---|---|
| Register with a weak password | PASS — rejected with the rule shown |
| Register with a strong password | PASS — account created, signed in, httpOnly session cookie |
| Verification e-mail token created at registration | PASS (delivery itself: not checked — no mail key locally) |
| Open verify link → e-mail verified; reuse refused | PASS |
| Forgot password: neutral message, token created | PASS |
| Reset link sets new password; reuse refused | PASS |
| Old password rejected with a clear message; new one logs in | PASS |
| Plain guest cannot open /app/admin or /owner | PASS |
| Log out → /trips redirects to login | PASS |
| Many sign-ins from one shared IP | FIXED: 5 successful logins from one address locked everybody out (IP counter counted successes). Now only failures count, 20 per 15 min per IP; the account limit stays 5 |

Not covered: Google sign-in (needs real Google), account claim for guest-checkout bookings, revocable sessions (audit S3, needs a migration), rate limiter is in-memory per server instance (audit item).
