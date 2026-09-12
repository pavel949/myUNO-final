# MIGRATION_DELIVERY.md — No-Loss Migration, Release and Recovery

## 1. Never mutate migration history from build/install
Normal install/build must not change Prisma migration history. Recovery is a deliberate operator action after migration logs, schema inspection, lock/process verification, backup and checksum/statement review.

## 2. Expand / contract
```text
backup → schema/data inventory → expand → compatible deploy → resumable backfill → parity → switch writer → switch reader → observe → contract later
```
No destructive migration in the same release as first reader/writer cutover.

## 3. Backfill
Must be resumable, checkpointed, idempotent, observable and report rejected/conflicting rows.

## 4. Financial invariants
Before/after compare booking totals, payments/refunds, statement balances, provider obligations, owner allocations and historical price/commission snapshots.

## 5. Identity invariants
No fuzzy automatic merge. Preserve aliases/old IDs. Consent never widens because identities merge.

## 6. Backup and restore
Automated backup, retention, off-project recovery copy where feasible, restore rehearsal, measured RPO/RTO, key/credential recovery and post-restore external payment/webhook reconciliation are required. DB restore alone is insufficient when external side effects occurred.

## 7. Jobs
Track last scheduled/started/succeeded, duration, retries, backlog, owner and alert. Frequency must match SLA; a daily cron cannot enforce minute-level commitments.

## 8. Integration recovery
Use durable inbox, idempotency, sequence/version protection, retry/backoff, dead letter/quarantine, replay, checkpoint and lag metrics.

## 9. Feature flags
Flags control rollout, not conceal broken flows. Disabled capabilities explain limitation, use a truthful fallback and preserve user intent when appropriate.

## 10. Rollback
Distinguish code rollback, schema compatibility, feature disable, external payments already executed, events already consumed and communications already sent. Never promise full rollback for irreversible side effects.
