# Process 1 — guest books a stay (search → request → approve → pay → cancel → refund)

Run on a **local production build** against a throw-away database (never prod). Script: `p1.mjs.txt`. Screenshots in this folder.

| Step | Result |
|---|---|
| Anonymous search lists homes with price | PASS (39 Layantara homes) |
| Unit page with dates shows total | PASS |
| Guest requests to book (cash / bank transfer) | PASS — `requested`, no hold yet |
| Host approves | PASS — `pending_payment`, dates held 24 h |
| Guest sees only the chosen payment rail | PASS after fix (was: card + transfer shown for a cash booking) |
| Transfer deadline never past the hold | PASS after fix (was 72 h vs 24 h hold) |
| No dispute panel before any charge | PASS after fix |
| Staff record cash → confirmed + revenue ledger line | PASS |
| Guest cancels → refund `requested` | PASS |
| Guest text for cash refund (not "original card") | PASS after fix |
| Staff pay the refund back → `refund_out` ledger, guest sees "paid" | PASS after fix (was: no way to settle; stuck forever) |
| Cancel unpaid transfer booking, nothing to refund | PASS |

Not covered here: card payment (Layantara has card disabled; mock provider covered by integration tests), real e-mail/Telegram delivery, TM30/passports (process 5).
