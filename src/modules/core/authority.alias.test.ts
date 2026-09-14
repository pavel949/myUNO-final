import { describe, it, expect } from 'vitest';
import { accessSatisfies } from '@/modules/core/authority.service';
import { PERMISSIONS, resolvePermissionAction } from '@/modules/core/permissions';

/**
 * `canWithAccess` is the seam mutation routes use because `can()` does not
 * distinguish a matrix row's 'read' access from 'allow' (Q58). Two properties
 * have to hold for that seam to be safe, and both were briefly untrue.
 */
describe('canWithAccess action resolution', () => {
  it('resolves legacy route action names to canonical matrix actions', () => {
    // Routes still use pre-matrix names. If the seam matched on the raw name it
    // would find zero permission rows and deny everyone but admin — closed, but
    // silently, which is the kind of bug that costs a day to find.
    expect(resolvePermissionAction('compliance:confirm_permitted_use')).toBe(
      'compliance:manage_compliance_records'
    );
    expect(resolvePermissionAction('units:update')).toBe('units:edit_listing');
    expect(resolvePermissionAction('config:edit')).toBe('admin:edit_configuration');
  });

  it('finds real permission rows once the alias is resolved', () => {
    const raw = PERMISSIONS.filter((p) => p.action === 'compliance:confirm_permitted_use');
    const resolved = PERMISSIONS.filter(
      (p) => p.action === resolvePermissionAction('compliance:confirm_permitted_use')
    );
    expect(raw).toHaveLength(0);
    expect(resolved.length).toBeGreaterThan(0);
  });

  it("does not let a 'read' grant satisfy a write", () => {
    expect(accessSatisfies('read', 'allow')).toBe(false);
    expect(accessSatisfies('allow', 'allow')).toBe(true);
    expect(accessSatisfies('read', 'read')).toBe(true);
    expect(accessSatisfies('allow', 'read')).toBe(true);
  });

  it('keeps owner and mc_member read-only on compliance records', () => {
    // The reason confirm-permitted-use must assert 'allow': confirming
    // permitted use is the hard gate before a unit goes live, and it is
    // ClearView's call, never the owner's.
    const rows = PERMISSIONS.filter(
      (p) => p.action === 'compliance:manage_compliance_records'
    );
    const readOnly = rows.filter((p) => p.access === 'read').map((p) => p.role).sort();
    expect(readOnly).toContain('owner');
    expect(readOnly).toContain('mc_member');
  });
});
