-- Reviews of a guest, after their stay.
--
-- Reviews ran one way: guests reviewed stays and service orders, and nobody
-- reviewed the guest. For a business letting private villas to a repeat
-- clientele that leaves the owner's first question unanswerable — "who stayed in
-- my villa, and were they any good" — and gives an operator no basis for
-- declining a returning guest who was a problem.
--
-- No new table. Review is already polymorphic (target_type + target_id) and
-- already carries rating, comment, a reply and a one-review-per-author
-- constraint. A guest review is that shape with a different target.
--
-- The target is the BOOKING, not the guest identity. Targeting the identity
-- would let the existing unique constraint record only one review per guest per
-- author for all time — so a guest who stayed four times could be reviewed once.
-- Per booking, a returning guest is reviewed each stay, and the reputation is
-- the set of them.

ALTER TYPE "ReviewTargetType" ADD VALUE IF NOT EXISTS 'guest';
