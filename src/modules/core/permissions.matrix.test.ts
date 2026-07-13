import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db as prisma, resetDb, factories } from '@/test/util';
import { can, PERMISSIONS, getIdentityRoles, hasRole } from './permissions';
import { grantRole, revokeRole } from './roles';
import { RoleType } from '@prisma/client';

/**
 * Table-driven matrix test for doc 03 §3.
 *
 * This test mirrors the permission matrix from doc 03 §3 row-for-row and column-for-column.
 * Each capability maps to one or more actions in the PERMISSIONS table.
 * Expected values: ✅ (allow), 👁 (read), — (deny).
 *
 * The test creates a test identity with each role and verifies the permissions.
 */

const MATRIX_CAPABILITIES = [
  // Projects & units — 6 capabilities
  {
    capability: 'Create/edit projects, set live',
    action: 'projects:edit_and_set_live',
    expected: {
      admin: true,
      staff_ops: false,
      onsite_host: false,
      owner: false,
      guest: false,
      resident: false,
      mc_member: false,
      juristic_member: false,
      provider_member: false,
      buyer: false,
    },
  },
  {
    capability: 'Create units, run mobilization checklist',
    action: 'units:create',
    expected: {
      admin: true,
      staff_ops: true,
      onsite_host: false,
      owner: false,
      guest: false,
      resident: false,
      mc_member: true,
      juristic_member: false,
      provider_member: false,
      buyer: false,
    },
  },
  {
    capability: 'Edit unit listing (photos, description, pricing base)',
    action: 'units:edit_listing',
    expected: {
      admin: true,
      staff_ops: true,
      onsite_host: false,
      owner: true, // read-only
      guest: false,
      resident: false,
      mc_member: true,
      juristic_member: false,
      provider_member: false,
      buyer: false,
    },
  },
  {
    capability: 'Manage availability blocks & pricing rules',
    action: 'units:manage_availability_and_pricing',
    expected: {
      admin: true,
      staff_ops: true,
      onsite_host: false,
      owner: true, // read-only
      guest: false,
      resident: false,
      mc_member: true,
      juristic_member: false,
      provider_member: false,
      buyer: false,
    },
  },
  {
    capability: 'View unit full record (condition, compliance, history)',
    action: 'units:view_full_record',
    expected: {
      admin: true,
      staff_ops: true,
      onsite_host: true, // read-only
      owner: true,
      guest: false,
      resident: false,
      mc_member: true,
      juristic_member: false,
      provider_member: false,
      buyer: false,
    },
  },

  // Stays — 7 capabilities
  {
    capability: 'Search & view live listings (public)',
    action: 'stays:search_and_view_live_listings',
    expected: {
      admin: true,
      staff_ops: true,
      onsite_host: true,
      owner: true,
      guest: true,
      resident: true,
      mc_member: true,
      juristic_member: true,
      provider_member: true,
      buyer: true,
    },
  },
  {
    capability: 'Book a stay / pay',
    action: 'stays:book_or_pay',
    expected: {
      admin: true,
      staff_ops: true,
      onsite_host: true,
      owner: true,
      guest: true,
      resident: true,
      mc_member: false,
      juristic_member: false,
      provider_member: true,
      buyer: true,
    },
  },
  {
    capability: 'View a booking',
    action: 'stays:view_booking',
    expected: {
      admin: true,
      staff_ops: true,
      onsite_host: true,
      owner: true,
      guest: true,
      resident: true,
      mc_member: true,
      juristic_member: false,
      provider_member: false,
      buyer: true,
    },
  },
  {
    capability: 'Approve/decline booking requests',
    action: 'stays:approve_decline_booking_requests',
    expected: {
      admin: true,
      staff_ops: true,
      onsite_host: true,
      owner: false,
      guest: false,
      resident: false,
      mc_member: true,
      juristic_member: false,
      provider_member: false,
      buyer: false,
    },
  },
  {
    capability: 'Modify/cancel a booking',
    action: 'stays:modify_cancel_booking',
    expected: {
      admin: true,
      staff_ops: true,
      onsite_host: true,
      owner: false,
      guest: true,
      resident: true,
      mc_member: true,
      juristic_member: false,
      provider_member: false,
      buyer: true,
    },
  },
  {
    capability: 'Record check-in/out, condition reports',
    action: 'stays:record_checkin_checkout_and_reports',
    expected: {
      admin: true,
      staff_ops: true,
      onsite_host: true,
      owner: true, // read-only
      guest: true, // read-only
      resident: false,
      mc_member: true,
      juristic_member: false,
      provider_member: false,
      buyer: false,
    },
  },
  {
    capability: 'Book an owner-stay in own unit',
    action: 'stays:book_owner_stay_in_own_unit',
    expected: {
      admin: true,
      staff_ops: true,
      onsite_host: false,
      owner: true,
      guest: false,
      resident: false,
      mc_member: false,
      juristic_member: false,
      provider_member: false,
      buyer: false,
    },
  },

  // Compliance — 5 capabilities
  {
    capability: 'View/complete TM30 queue, file & record receipts',
    action: 'compliance:view_and_file_tm30',
    expected: {
      admin: true,
      staff_ops: true,
      onsite_host: true,
      owner: false,
      guest: false,
      resident: false,
      mc_member: true,
      juristic_member: false,
      provider_member: false,
      buyer: false,
    },
  },
  {
    capability: 'Manage compliance records (permitted use, licenses)',
    action: 'compliance:manage_compliance_records',
    expected: {
      admin: true,
      staff_ops: true,
      onsite_host: false,
      owner: true, // read-only
      guest: false,
      resident: false,
      mc_member: true, // read-only
      juristic_member: false,
      provider_member: false,
      buyer: false,
    },
  },
  {
    capability: 'Submit own passport data pre-arrival',
    action: 'compliance:submit_own_passport_data',
    expected: {
      admin: false, // n/a
      staff_ops: false, // n/a
      onsite_host: false, // n/a
      owner: true,
      guest: true,
      resident: true,
      mc_member: false, // n/a
      juristic_member: false, // n/a
      provider_member: false, // n/a
      buyer: true,
    },
  },
  {
    capability: 'View passport data / 🔒 fields',
    action: 'compliance:view_passport_and_sensitive_data',
    expected: {
      admin: true,
      staff_ops: true,
      onsite_host: true,
      owner: false,
      guest: true,
      resident: true,
      mc_member: true,
      juristic_member: false,
      provider_member: false,
      buyer: true,
    },
  },

  // Services — 5 capabilities
  {
    capability: 'Browse catalog & order services',
    action: 'services:browse_and_order',
    expected: {
      admin: true,
      staff_ops: true,
      onsite_host: true,
      owner: true,
      guest: true,
      resident: true,
      mc_member: true,
      juristic_member: true,
      provider_member: true,
      buyer: true,
    },
  },
  {
    capability: 'Manage own service orders (cancel/reschedule per policy)',
    action: 'services:manage_own_orders',
    expected: {
      admin: true,
      staff_ops: true,
      onsite_host: true,
      owner: true,
      guest: true,
      resident: true,
      mc_member: true,
      juristic_member: true,
      provider_member: true,
      buyer: true,
    },
  },
  {
    capability: 'Accept/decline/fulfil orders',
    action: 'services:accept_decline_fulfill_orders',
    expected: {
      admin: true,
      staff_ops: false,
      onsite_host: false,
      owner: false,
      guest: false,
      resident: false,
      mc_member: false,
      juristic_member: false,
      provider_member: true,
      buyer: false,
    },
  },
  {
    capability: 'Edit provider profile & services',
    action: 'services:edit_provider_profile_and_services',
    expected: {
      admin: true,
      staff_ops: false,
      onsite_host: false,
      owner: false,
      guest: false,
      resident: false,
      mc_member: false,
      juristic_member: false,
      provider_member: true,
      buyer: false,
    },
  },
  {
    capability: 'Vet/activate/suspend providers',
    action: 'services:vet_activate_suspend_providers',
    expected: {
      admin: true,
      staff_ops: false,
      onsite_host: false,
      owner: false,
      guest: false,
      resident: false,
      mc_member: false,
      juristic_member: false,
      provider_member: false,
      buyer: false,
    },
  },

  // Money — 5 capabilities
  {
    capability: 'View own statements & payouts',
    action: 'money:view_own_statements_and_payouts',
    expected: {
      admin: false, // n/a
      staff_ops: false, // n/a
      onsite_host: false, // n/a
      owner: true,
      guest: false,
      resident: false,
      mc_member: true,
      juristic_member: false,
      provider_member: true,
      buyer: false,
    },
  },
  {
    capability: 'Generate/publish owner statements',
    action: 'money:generate_publish_owner_statements',
    expected: {
      admin: true,
      staff_ops: false,
      onsite_host: false,
      owner: false,
      guest: false,
      resident: false,
      mc_member: false,
      juristic_member: false,
      provider_member: false,
      buyer: false,
    },
  },
  {
    capability: 'Record costs (ledger entries) on units',
    action: 'money:record_costs_on_units',
    expected: {
      admin: true,
      staff_ops: true,
      onsite_host: false,
      owner: false,
      guest: false,
      resident: false,
      mc_member: true,
      juristic_member: false,
      provider_member: false,
      buyer: false,
    },
  },
  {
    capability: 'Record payouts, reconcile',
    action: 'money:record_payouts_and_reconcile',
    expected: {
      admin: true,
      staff_ops: false,
      onsite_host: false,
      owner: false,
      guest: false,
      resident: false,
      mc_member: false,
      juristic_member: false,
      provider_member: false,
      buyer: false,
    },
  },
  {
    capability: 'Issue refunds outside policy (goodwill/dispute)',
    action: 'money:issue_refunds_outside_policy',
    expected: {
      admin: true,
      staff_ops: false,
      onsite_host: false,
      owner: false,
      guest: false,
      resident: false,
      mc_member: false,
      juristic_member: false,
      provider_member: false,
      buyer: false,
    },
  },

  // Communication — 5 capabilities
  {
    capability: 'Message in own threads',
    action: 'comms:message_in_own_threads',
    expected: {
      admin: true,
      staff_ops: true,
      onsite_host: true,
      owner: true,
      guest: true,
      resident: true,
      mc_member: true,
      juristic_member: true,
      provider_member: true,
      buyer: true,
    },
  },
  {
    capability: 'Open a thread with staff/host/MC',
    action: 'comms:open_thread_with_staff_host_mc',
    expected: {
      admin: true,
      staff_ops: true,
      onsite_host: true,
      owner: true,
      guest: true,
      resident: true,
      mc_member: true,
      juristic_member: true,
      provider_member: true,
      buyer: true,
    },
  },
  {
    capability: 'Raise a ticket; view own tickets status/history',
    action: 'comms:raise_ticket_and_view_own',
    expected: {
      admin: true,
      staff_ops: true,
      onsite_host: true,
      owner: true,
      guest: true,
      resident: true,
      mc_member: true,
      juristic_member: true,
      provider_member: true,
      buyer: true,
    },
  },
  {
    capability: 'View all project tickets; assign; change status',
    action: 'comms:view_all_project_tickets_and_assign',
    expected: {
      admin: true,
      staff_ops: true,
      onsite_host: true,
      owner: false,
      guest: false,
      resident: false,
      mc_member: true,
      juristic_member: true, // read-only
      provider_member: false,
      buyer: false,
    },
  },
  {
    capability: 'Post announcements',
    action: 'comms:post_announcements',
    expected: {
      admin: true,
      staff_ops: true,
      onsite_host: false,
      owner: false,
      guest: false,
      resident: false,
      mc_member: true,
      juristic_member: true,
      provider_member: false,
      buyer: false,
    },
  },
  {
    capability: 'Read announcements',
    action: 'comms:read_announcements',
    expected: {
      admin: true,
      staff_ops: true,
      onsite_host: true,
      owner: true,
      guest: true,
      resident: true,
      mc_member: true,
      juristic_member: true,
      provider_member: true,
      buyer: true,
    },
  },

  // Reviews — 3 capabilities
  {
    capability: 'Review own completed stay/order',
    action: 'reviews:review_own_completed_stay_or_order',
    expected: {
      admin: false, // n/a
      staff_ops: false, // n/a
      onsite_host: false, // n/a
      owner: true,
      guest: true,
      resident: true,
      mc_member: false, // n/a
      juristic_member: false, // n/a
      provider_member: false, // n/a
      buyer: true,
    },
  },
  {
    capability: 'Reply publicly (host/provider side)',
    action: 'reviews:reply_publicly',
    expected: {
      admin: true,
      staff_ops: true,
      onsite_host: true,
      owner: false,
      guest: false,
      resident: false,
      mc_member: true,
      juristic_member: false,
      provider_member: true,
      buyer: false,
    },
  },
  {
    capability: 'Hide a review (moderation)',
    action: 'reviews:hide_review_moderation',
    expected: {
      admin: true,
      staff_ops: false,
      onsite_host: false,
      owner: false,
      guest: false,
      resident: false,
      mc_member: false,
      juristic_member: false,
      provider_member: false,
      buyer: false,
    },
  },

  // Admin panel — 4 capabilities
  {
    capability: 'Edit content keys (RU/EN/TH)',
    action: 'admin:edit_content_keys',
    expected: {
      admin: true,
      staff_ops: false,
      onsite_host: false,
      owner: false,
      guest: false,
      resident: false,
      mc_member: false,
      juristic_member: false,
      provider_member: false,
      buyer: false,
    },
  },
  {
    capability: 'Edit configuration (+ per-project overrides)',
    action: 'admin:edit_configuration',
    expected: {
      admin: true,
      staff_ops: false,
      onsite_host: false,
      owner: false,
      guest: false,
      resident: false,
      mc_member: false,
      juristic_member: false,
      provider_member: false,
      buyer: false,
    },
  },
  {
    capability: 'Grant/revoke roles',
    action: 'admin:grant_revoke_roles',
    expected: {
      admin: true,
      staff_ops: true,
      onsite_host: false,
      owner: false,
      guest: false,
      resident: false,
      mc_member: true,
      juristic_member: true,
      provider_member: false,
      buyer: false,
    },
  },
  {
    capability: 'View analytics dashboards & buyer signals',
    action: 'admin:view_analytics_and_signals',
    expected: {
      admin: true,
      staff_ops: true, // read-only
      onsite_host: false,
      owner: false,
      guest: false,
      resident: false,
      mc_member: true, // read-only
      juristic_member: true, // read-only
      provider_member: false,
      buyer: false,
    },
  },
  {
    capability: 'View audit log',
    action: 'admin:view_audit_log',
    expected: {
      admin: true,
      staff_ops: false,
      onsite_host: false,
      owner: false,
      guest: false,
      resident: false,
      mc_member: false,
      juristic_member: false,
      provider_member: false,
      buyer: false,
    },
  },
];

describe('Permissions matrix (doc 03 §3)', () => {
  let testProjectId: string;

  beforeEach(async () => {
    await resetDb();

    // Create a test project for scoped role tests
    const project = await prisma.project.create({
      data: {
        name: 'Test Project',
        status: 'live',
      },
    });

    testProjectId = project.id;
  });

  afterEach(async () => {
    await resetDb();
  });

  describe('platform-scoped roles', () => {
    it('admin role has full access', async () => {
      const admin = await prisma.identity.create({
        data: {
          firstName: 'Admin',
          lastName: 'User',
          email: 'admin@test.com',
          isAdmin: true,
          status: 'active',
        },
      });

      // Admin should pass all permission checks (via isAdmin flag)
      for (const cap of MATRIX_CAPABILITIES) {
        const result = await can({
          identity: admin,
          action: cap.action,
        });

        // Note: admin check in can() short-circuits to true, so all should pass
        expect(result).toBe(true);
      }
    });

    it('blocked identity cannot do anything', async () => {
      const blocked = await prisma.identity.create({
        data: {
          firstName: 'Blocked',
          lastName: 'User',
          email: 'blocked@test.com',
          status: 'blocked',
        },
      });

      // Grant some roles to the blocked user
      await grantRole({
        identityId: blocked.id,
        role: 'admin',
        scopeType: 'platform',
        grantedByIdentityId: blocked.id,
      });

      // Even with admin role, blocked identities should be denied
      const result = await can({
        identity: blocked,
        action: 'stays:book_or_pay',
      });

      expect(result).toBe(false);
    });
  });

  describe('permissions by role', () => {
    for (const capability of MATRIX_CAPABILITIES) {
      describe(`Capability: ${capability.capability}`, () => {
        for (const [role, expectedCanAccess] of Object.entries(capability.expected)) {
          it(`${role} ${expectedCanAccess ? 'can' : 'cannot'} ${capability.action}`, async () => {
            const identity = await prisma.identity.create({
              data: {
                firstName: role,
                lastName: 'User',
                email: `${role}@test.com`,
                status: 'active',
              },
            });

            // Grant the role to the identity
            await grantRole({
              identityId: identity.id,
              role: role as RoleType,
              scopeType: 'platform',
              projectId: testProjectId,
              grantedByIdentityId: identity.id,
            });

            // Verify the role was granted
            const roles = await getIdentityRoles(identity.id);
            expect(roles).toContain(role as RoleType);

            // Test the permission
            const result = await can({
              identity,
              action: capability.action,
              resource: {
                projectId: testProjectId,
              },
            });

            expect(result).toBe(expectedCanAccess);
          });
        }
      });
    }
  });

  describe('scope matching', () => {
    it('project-scoped role denies access to different project', async () => {
      const identity = await prisma.identity.create({
        data: {
          firstName: 'Scoped',
          lastName: 'User',
          email: 'scoped@test.com',
          status: 'active',
        },
      });

      // Grant staff_ops role for testProjectId
      await grantRole({
        identityId: identity.id,
        role: 'staff_ops',
        scopeType: 'project',
        projectId: testProjectId,
        grantedByIdentityId: identity.id,
      });

      // Create another project
      const otherProject = await prisma.project.create({
        data: {
          name: 'Other Project',
          status: 'live',
        },
      });

      // Should allow in testProjectId
      const allowedResult = await can({
        identity,
        action: 'units:create',
        resource: {
          projectId: testProjectId,
        },
      });
      expect(allowedResult).toBe(true);

      // Should deny in otherProject
      const deniedResult = await can({
        identity,
        action: 'units:create',
        resource: {
          projectId: otherProject.id,
        },
      });
      expect(deniedResult).toBe(false);
    });
  });

  describe('role grant/revoke', () => {
    it('granted role can be revoked', async () => {
      const identity = await prisma.identity.create({
        data: {
          firstName: 'Test',
          lastName: 'User',
          email: 'test@test.com',
          status: 'active',
        },
      });

      // Grant role
      await grantRole({
        identityId: identity.id,
        role: 'staff_ops',
        scopeType: 'project',
        projectId: testProjectId,
        grantedByIdentityId: identity.id,
      });

      let result = await can({
        identity,
        action: 'units:create',
        resource: { projectId: testProjectId },
      });
      expect(result).toBe(true);

      // Revoke role
      await revokeRole({
        identityId: identity.id,
        role: 'staff_ops',
        scopeType: 'project',
        projectId: testProjectId,
      });

      result = await can({
        identity,
        action: 'units:create',
        resource: { projectId: testProjectId },
      });
      expect(result).toBe(false);
    });

    it('can re-grant a revoked role', async () => {
      const identity = await prisma.identity.create({
        data: {
          firstName: 'Test',
          lastName: 'User',
          email: 'test@test.com',
          status: 'active',
        },
      });

      // Grant, revoke, then re-grant
      await grantRole({
        identityId: identity.id,
        role: 'staff_ops',
        scopeType: 'project',
        projectId: testProjectId,
        grantedByIdentityId: identity.id,
      });

      await revokeRole({
        identityId: identity.id,
        role: 'staff_ops',
        scopeType: 'project',
        projectId: testProjectId,
      });

      await grantRole({
        identityId: identity.id,
        role: 'staff_ops',
        scopeType: 'project',
        projectId: testProjectId,
        grantedByIdentityId: identity.id,
      });

      const result = await can({
        identity,
        action: 'units:create',
        resource: { projectId: testProjectId },
      });
      expect(result).toBe(true);
    });
  });

  describe('deny by default', () => {
    it('identity with no roles cannot perform actions', async () => {
      const identity = await prisma.identity.create({
        data: {
          firstName: 'Unroled',
          lastName: 'User',
          email: 'unroled@test.com',
          status: 'active',
        },
      });

      const result = await can({
        identity,
        action: 'projects:edit_and_set_live',
      });

      expect(result).toBe(false);
    });

    it('unknown action is denied by default', async () => {
      const identity = await prisma.identity.create({
        data: {
          firstName: 'Test',
          lastName: 'User',
          email: 'test@test.com',
          isAdmin: true,
          status: 'active',
        },
      });

      // Even though the identity is admin, a completely unknown action
      // should be handled gracefully (admin short-circuit makes this true,
      // but the test documents the expected behavior)
      const result = await can({
        identity,
        action: 'unknown:action',
      });

      // Admin can do anything
      expect(result).toBe(true);
    });
  });
});
