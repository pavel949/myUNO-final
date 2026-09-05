import { Identity } from '@prisma/client';
import { can } from './permissions';
import { logAudit } from '@/modules/audit';

interface PassportAccessParams {
  identity: Identity;
  /** The identity whose passport / 🔒 fields are being read. */
  subjectIdentityId: string;
  /** What the audit entry is filed against — e.g. 'PartyMember', 'Booking'. */
  entityType: string;
  entityId: string;
  /** Required whenever the accessor is not the subject (the "logged + reason" roles). */
  reason?: string;
  resource?: { unitId?: string; projectId?: string; bookingId?: string };
}

type PassportAccessResult = { ok: true } | { ok: false; error: 'forbidden' | 'reason_required' };

/**
 * Gate for opening a guest passport / other 🔒 fields — doc 12 §§1, 4 and
 * the design system's permission matrix (canvas board 19), which states
 * this as one of the two absolutes in the whole table: owners, providers
 * and MC/juristic members may **never** open a guest passport; only
 * ops (staff_ops, onsite_host) and admin may, and only "logged + reason".
 *
 * `can()` alone is not enough here: admin bypasses it entirely (permissions.ts
 * rule 2), which is correct for ordinary actions but would make admin passport
 * access silent — exactly the one case doc 12 requires a name and a stated
 * reason for. This wrapper is what actually enforces "logged + reason": it
 * sits in front of every passport read, whoever the reader is.
 *
 * Viewing your own record (guest/resident/buyer, scope `own_only`) needs
 * neither a reason nor an audit entry — nothing is being disclosed to
 * anyone but the person it belongs to.
 */
export async function requirePassportAccess(params: PassportAccessParams): Promise<PassportAccessResult> {
  const { identity, subjectIdentityId, entityType, entityId, reason, resource } = params;

  if (identity.id === subjectIdentityId) {
    return { ok: true };
  }

  const allowed = await can({
    identity,
    action: 'compliance:view_passport_and_sensitive_data',
    resource,
  });
  if (!allowed) {
    return { ok: false, error: 'forbidden' };
  }

  if (!reason || !reason.trim()) {
    return { ok: false, error: 'reason_required' };
  }

  await logAudit({
    actorIdentityId: identity.id,
    action: 'compliance:view_passport_and_sensitive_data',
    entityType,
    entityId,
    data: { reason, subjectIdentityId },
  });

  return { ok: true };
}
