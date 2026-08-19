-- Financial snapshots and the audit log become immutable (P1-1, P1-3).
--
-- CLAUDE.md promises owners that fee history is immutable and that every role
-- grant, config change and PII access is auditable. Neither promise was
-- enforced: `price_breakdown` and `cancellation_policy_snapshot` were ordinary
-- updatable JSON, and `audit_log` had no trigger or revoke anywhere in the
-- schema — any code path could rewrite or delete an entry.
--
-- Nothing in the application does either today. That is exactly when to add the
-- constraint: it costs nothing now and it is the difference between a promise
-- and a guarantee when someone disputes a statement in a year.
--
-- Scope note, stated rather than implied: these are ordinary triggers, so a
-- superuser session that sets `session_replication_role = 'replica'` bypasses
-- them — which is how the test suite truncates between cases. They stop the
-- application from mutating these records; they are not a defence against
-- someone holding the database owner's credentials.

-- 1. A confirmed booking's economics cannot be rewritten -------------------
--
-- Once written, a snapshot is frozen. Setting one where none existed is still
-- allowed, so a booking created before this migration can be completed, and a
-- backfill remains possible.
--
-- `total_thb` is deliberately NOT frozen: an extension the guest agreed to
-- legitimately changes what they owe. What must not change is the record of the
-- terms the booking was sold under.

CREATE OR REPLACE FUNCTION booking_snapshot_is_immutable()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD."price_breakdown" IS NOT NULL
       AND NEW."price_breakdown" IS DISTINCT FROM OLD."price_breakdown" THEN
        RAISE EXCEPTION
            'price_breakdown is immutable once set (booking %). The price a booking was sold at is a financial record, not a mutable field.',
            OLD."id"
        USING ERRCODE = 'restrict_violation';
    END IF;

    IF OLD."cancellation_policy_snapshot" IS NOT NULL
       AND NEW."cancellation_policy_snapshot" IS DISTINCT FROM OLD."cancellation_policy_snapshot" THEN
        RAISE EXCEPTION
            'cancellation_policy_snapshot is immutable once set (booking %). The guest agreed to these terms; a later config change cannot rewrite them.',
            OLD."id"
        USING ERRCODE = 'restrict_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS booking_snapshot_immutable ON "booking";
CREATE TRIGGER booking_snapshot_immutable
    BEFORE UPDATE ON "booking"
    FOR EACH ROW
    EXECUTE FUNCTION booking_snapshot_is_immutable();

-- 2. The audit log is append-only ------------------------------------------
--
-- An audit trail that can be edited is not an audit trail. Corrections are made
-- by appending a further entry, which is the point: the original claim and the
-- correction both remain visible.

CREATE OR REPLACE FUNCTION audit_log_is_append_only()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION
        'audit_log is append-only; % is not permitted. Record a correcting entry instead.',
        TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_append_only ON "audit_log";
CREATE TRIGGER audit_log_append_only
    BEFORE UPDATE OR DELETE ON "audit_log"
    FOR EACH ROW
    EXECUTE FUNCTION audit_log_is_append_only();
