# Process 6 — service order: order → pay (cash) → provider accepts → fulfils → guest rates

Local production build; browser as guest, admin (cash desk), provider.

| Step | Result |
|---|---|
| Browse services, open one, choose time/quantity/note, place order | PASS |
| Order detail shows the price | FIXED — also showed internal fields ("Price Model NaN", "Offer Source NaN", "Terms Version 0", "Lead Time Hours"); now only quantity and unit price |
| Order list time vs detail time | FIXED — list showed server time (10:00) while detail showed Phuket time (17:00) |
| Provider queue offered "Accept" on an unpaid order → generic 500 | FIXED — unpaid orders show "Waiting for the customer to pay"; wrong-state actions return 409 with a clear message |
| Staff record cash on the ops board → order `paid` | PASS |
| Provider accepts → `accepted`; guest sees it | PASS |
| Provider marks fulfilled → `fulfilled`, platform commission (15%) on the ledger | PASS |
| Guest rates the service | PASS (review stored, published) |

Not covered: card payment via provider (mock only), provider remittance payout, decline/refund path (covered by integration tests), the auto-close after the dispute window (scheduler).
