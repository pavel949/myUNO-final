import { Identity, RoleAssignment, RoleType } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type AccessLevel = 'allow' | 'read';

interface PermissionEntry {
  action: string;
  role: RoleType;
  access: AccessLevel;
  resource?: string; // what kind of resource (e.g., 'unit', 'booking', 'project')
  scope?: string; // scope hint for documentation (e.g., 'own_units', 'their_projects')
}

/**
 * PERMISSIONS table — mirrors doc 03 §3 row-for-row.
 * Format: action, role, access level (allow/read), scope/resource hints.
 * Special conditions are checked in the can() function.
 *
 * Note: 'admin' is not included here because admin access is handled via Identity.isAdmin flag,
 * which bypasses all permission checks in the can() function.
 */
export const PERMISSIONS: PermissionEntry[] = [
  // Projects & units — 6 capabilities
  // NOTE: 'projects:edit_and_set_live' is admin-only per doc 03 §3 (row:
  // "Create/edit projects, set live" = ✅ only for admin). staff_ops must NOT
  // have it — an earlier allow row here was a privilege escalation (removed).

  { action: 'units:create', role: 'staff_ops', access: 'allow' },
  { action: 'units:create', role: 'mc_member', access: 'allow', scope: 'their_units' },

  { action: 'units:edit_listing', role: 'staff_ops', access: 'allow' },
  { action: 'units:edit_listing', role: 'owner', access: 'read', scope: 'own_units' },
  { action: 'units:edit_listing', role: 'mc_member', access: 'allow', scope: 'their_units' },

  { action: 'units:manage_availability_and_pricing', role: 'staff_ops', access: 'allow' },
  { action: 'units:manage_availability_and_pricing', role: 'owner', access: 'read', scope: 'own_units' },
  { action: 'units:manage_availability_and_pricing', role: 'mc_member', access: 'allow', scope: 'their_units' },

  { action: 'units:view_full_record', role: 'staff_ops', access: 'allow' },
  { action: 'units:view_full_record', role: 'onsite_host', access: 'read' },
  { action: 'units:view_full_record', role: 'owner', access: 'allow', scope: 'own_units' },
  { action: 'units:view_full_record', role: 'mc_member', access: 'allow', scope: 'their_units' },

  // Stays — 7 capabilities
  { action: 'stays:search_and_view_live_listings', role: 'staff_ops', access: 'allow' },
  { action: 'stays:search_and_view_live_listings', role: 'onsite_host', access: 'allow' },
  { action: 'stays:search_and_view_live_listings', role: 'owner', access: 'allow' },
  { action: 'stays:search_and_view_live_listings', role: 'guest', access: 'allow' },
  { action: 'stays:search_and_view_live_listings', role: 'resident', access: 'allow' },
  { action: 'stays:search_and_view_live_listings', role: 'mc_member', access: 'allow' },
  { action: 'stays:search_and_view_live_listings', role: 'juristic_member', access: 'allow' },
  { action: 'stays:search_and_view_live_listings', role: 'provider_member', access: 'allow' },
  { action: 'stays:search_and_view_live_listings', role: 'buyer', access: 'allow' },

  { action: 'stays:book_or_pay', role: 'staff_ops', access: 'allow', scope: 'manual_agent_booking' },
  { action: 'stays:book_or_pay', role: 'onsite_host', access: 'allow', scope: 'manual_booking' },
  { action: 'stays:book_or_pay', role: 'owner', access: 'allow', scope: 'any_unit_or_owner_stay' },
  { action: 'stays:book_or_pay', role: 'guest', access: 'allow' },
  { action: 'stays:book_or_pay', role: 'resident', access: 'allow' },
  { action: 'stays:book_or_pay', role: 'provider_member', access: 'allow', scope: 'as_a_person' },
  { action: 'stays:book_or_pay', role: 'buyer', access: 'allow' },

  { action: 'stays:view_booking', role: 'staff_ops', access: 'allow' },
  { action: 'stays:view_booking', role: 'onsite_host', access: 'allow' },
  { action: 'stays:view_booking', role: 'owner', access: 'allow', scope: 'own_units_bookings' },
  { action: 'stays:view_booking', role: 'guest', access: 'allow', scope: 'own_bookings' },
  { action: 'stays:view_booking', role: 'resident', access: 'allow', scope: 'own_bookings' },
  { action: 'stays:view_booking', role: 'mc_member', access: 'allow', scope: 'their_units_bookings' },
  { action: 'stays:view_booking', role: 'buyer', access: 'allow', scope: 'own_bookings' },

  { action: 'stays:approve_decline_booking_requests', role: 'staff_ops', access: 'allow' },
  { action: 'stays:approve_decline_booking_requests', role: 'onsite_host', access: 'allow' },
  { action: 'stays:approve_decline_booking_requests', role: 'mc_member', access: 'allow', scope: 'their_units' },

  { action: 'stays:modify_cancel_booking', role: 'staff_ops', access: 'allow' },
  { action: 'stays:modify_cancel_booking', role: 'onsite_host', access: 'allow' },
  { action: 'stays:modify_cancel_booking', role: 'guest', access: 'allow', scope: 'own_per_policy' },
  { action: 'stays:modify_cancel_booking', role: 'resident', access: 'allow', scope: 'own' },
  { action: 'stays:modify_cancel_booking', role: 'mc_member', access: 'allow', scope: 'their_units_ops_side' },
  { action: 'stays:modify_cancel_booking', role: 'buyer', access: 'allow', scope: 'own' },

  { action: 'stays:record_checkin_checkout_and_reports', role: 'staff_ops', access: 'allow' },
  { action: 'stays:record_checkin_checkout_and_reports', role: 'onsite_host', access: 'allow' },
  { action: 'stays:record_checkin_checkout_and_reports', role: 'owner', access: 'read', scope: 'own_units' },
  { action: 'stays:record_checkin_checkout_and_reports', role: 'guest', access: 'read', scope: 'own_stay_reports' },
  { action: 'stays:record_checkin_checkout_and_reports', role: 'mc_member', access: 'allow', scope: 'their_units' },

  { action: 'stays:book_owner_stay_in_own_unit', role: 'staff_ops', access: 'allow', scope: 'for_owner' },
  { action: 'stays:book_owner_stay_in_own_unit', role: 'owner', access: 'allow' },

  // Compliance — 5 capabilities
  { action: 'compliance:view_and_file_tm30', role: 'staff_ops', access: 'allow' },
  { action: 'compliance:view_and_file_tm30', role: 'onsite_host', access: 'allow' },
  { action: 'compliance:view_and_file_tm30', role: 'mc_member', access: 'allow', scope: 'their_units_stays' },

  { action: 'compliance:manage_compliance_records', role: 'staff_ops', access: 'allow' },
  { action: 'compliance:manage_compliance_records', role: 'owner', access: 'read', scope: 'own_units' },
  { action: 'compliance:manage_compliance_records', role: 'mc_member', access: 'read', scope: 'their_units' },

  { action: 'compliance:submit_own_passport_data', role: 'owner', access: 'allow' },
  { action: 'compliance:submit_own_passport_data', role: 'guest', access: 'allow' },
  { action: 'compliance:submit_own_passport_data', role: 'resident', access: 'allow' },
  { action: 'compliance:submit_own_passport_data', role: 'buyer', access: 'allow' },

  { action: 'compliance:view_passport_and_sensitive_data', role: 'staff_ops', access: 'allow', scope: 'while_operationally_needed' },
  { action: 'compliance:view_passport_and_sensitive_data', role: 'onsite_host', access: 'allow', scope: 'arrivals_only' },
  { action: 'compliance:view_passport_and_sensitive_data', role: 'guest', access: 'allow', scope: 'own_only' },
  { action: 'compliance:view_passport_and_sensitive_data', role: 'resident', access: 'allow', scope: 'own_only' },
  { action: 'compliance:view_passport_and_sensitive_data', role: 'mc_member', access: 'allow', scope: 'their_units_arrivals' },
  { action: 'compliance:view_passport_and_sensitive_data', role: 'buyer', access: 'allow', scope: 'own_only' },

  // Services — 5 capabilities
  { action: 'services:browse_and_order', role: 'staff_ops', access: 'allow' },
  { action: 'services:browse_and_order', role: 'onsite_host', access: 'allow' },
  { action: 'services:browse_and_order', role: 'owner', access: 'allow' },
  { action: 'services:browse_and_order', role: 'guest', access: 'allow' },
  { action: 'services:browse_and_order', role: 'resident', access: 'allow' },
  { action: 'services:browse_and_order', role: 'mc_member', access: 'allow' },
  { action: 'services:browse_and_order', role: 'juristic_member', access: 'allow' },
  { action: 'services:browse_and_order', role: 'provider_member', access: 'allow' },
  { action: 'services:browse_and_order', role: 'buyer', access: 'allow' },

  { action: 'services:manage_own_orders', role: 'staff_ops', access: 'allow' },
  { action: 'services:manage_own_orders', role: 'onsite_host', access: 'allow' },
  { action: 'services:manage_own_orders', role: 'owner', access: 'allow' },
  { action: 'services:manage_own_orders', role: 'guest', access: 'allow' },
  { action: 'services:manage_own_orders', role: 'resident', access: 'allow' },
  { action: 'services:manage_own_orders', role: 'mc_member', access: 'allow' },
  { action: 'services:manage_own_orders', role: 'juristic_member', access: 'allow' },
  { action: 'services:manage_own_orders', role: 'provider_member', access: 'allow' },
  { action: 'services:manage_own_orders', role: 'buyer', access: 'allow' },

  { action: 'services:accept_decline_fulfill_orders', role: 'provider_member', access: 'allow', scope: 'their_provider' },

  { action: 'services:edit_provider_profile_and_services', role: 'provider_member', access: 'allow', scope: 'their_provider' },

  // Money — 5 capabilities
  { action: 'money:view_own_statements_and_payouts', role: 'owner', access: 'allow', scope: 'own_units' },
  { action: 'money:view_own_statements_and_payouts', role: 'mc_member', access: 'allow', scope: 'their_org_fee_reports' },
  { action: 'money:view_own_statements_and_payouts', role: 'provider_member', access: 'allow', scope: 'their_remittances' },

  { action: 'money:record_costs_on_units', role: 'staff_ops', access: 'allow' },
  { action: 'money:record_costs_on_units', role: 'mc_member', access: 'allow', scope: 'their_units' },

  // Communication — 5 capabilities
  { action: 'comms:message_in_own_threads', role: 'staff_ops', access: 'allow' },
  { action: 'comms:message_in_own_threads', role: 'onsite_host', access: 'allow' },
  { action: 'comms:message_in_own_threads', role: 'owner', access: 'allow' },
  { action: 'comms:message_in_own_threads', role: 'guest', access: 'allow' },
  { action: 'comms:message_in_own_threads', role: 'resident', access: 'allow' },
  { action: 'comms:message_in_own_threads', role: 'mc_member', access: 'allow' },
  { action: 'comms:message_in_own_threads', role: 'juristic_member', access: 'allow' },
  { action: 'comms:message_in_own_threads', role: 'provider_member', access: 'allow' },
  { action: 'comms:message_in_own_threads', role: 'buyer', access: 'allow' },

  { action: 'comms:open_thread_with_staff_host_mc', role: 'staff_ops', access: 'allow' },
  { action: 'comms:open_thread_with_staff_host_mc', role: 'onsite_host', access: 'allow' },
  { action: 'comms:open_thread_with_staff_host_mc', role: 'owner', access: 'allow' },
  { action: 'comms:open_thread_with_staff_host_mc', role: 'guest', access: 'allow' },
  { action: 'comms:open_thread_with_staff_host_mc', role: 'resident', access: 'allow' },
  { action: 'comms:open_thread_with_staff_host_mc', role: 'mc_member', access: 'allow' },
  { action: 'comms:open_thread_with_staff_host_mc', role: 'juristic_member', access: 'allow' },
  { action: 'comms:open_thread_with_staff_host_mc', role: 'provider_member', access: 'allow' },
  { action: 'comms:open_thread_with_staff_host_mc', role: 'buyer', access: 'allow' },

  { action: 'comms:raise_ticket_and_view_own', role: 'staff_ops', access: 'allow' },
  { action: 'comms:raise_ticket_and_view_own', role: 'onsite_host', access: 'allow' },
  { action: 'comms:raise_ticket_and_view_own', role: 'owner', access: 'allow' },
  { action: 'comms:raise_ticket_and_view_own', role: 'guest', access: 'allow' },
  { action: 'comms:raise_ticket_and_view_own', role: 'resident', access: 'allow' },
  { action: 'comms:raise_ticket_and_view_own', role: 'mc_member', access: 'allow' },
  { action: 'comms:raise_ticket_and_view_own', role: 'juristic_member', access: 'allow' },
  { action: 'comms:raise_ticket_and_view_own', role: 'provider_member', access: 'allow' },
  { action: 'comms:raise_ticket_and_view_own', role: 'buyer', access: 'allow' },

  { action: 'comms:view_all_project_tickets_and_assign', role: 'staff_ops', access: 'allow' },
  { action: 'comms:view_all_project_tickets_and_assign', role: 'onsite_host', access: 'allow', scope: 'guest_facing_cats' },
  { action: 'comms:view_all_project_tickets_and_assign', role: 'mc_member', access: 'allow', scope: 'their_units_org' },
  { action: 'comms:view_all_project_tickets_and_assign', role: 'juristic_member', access: 'read', scope: 'project_stats' },

  { action: 'comms:post_announcements', role: 'staff_ops', access: 'allow', scope: 'as_myuno_own_projects' },
  { action: 'comms:post_announcements', role: 'mc_member', access: 'allow', scope: 'as_management_company' },
  { action: 'comms:post_announcements', role: 'juristic_member', access: 'allow', scope: 'as_juristic_person' },

  // Announcements — reading is handled by audience field, not permissions
  { action: 'comms:read_announcements', role: 'staff_ops', access: 'allow' },
  { action: 'comms:read_announcements', role: 'onsite_host', access: 'allow' },
  { action: 'comms:read_announcements', role: 'owner', access: 'allow' },
  { action: 'comms:read_announcements', role: 'guest', access: 'allow' },
  { action: 'comms:read_announcements', role: 'resident', access: 'allow' },
  { action: 'comms:read_announcements', role: 'mc_member', access: 'allow' },
  { action: 'comms:read_announcements', role: 'juristic_member', access: 'allow' },
  { action: 'comms:read_announcements', role: 'provider_member', access: 'allow' },
  { action: 'comms:read_announcements', role: 'buyer', access: 'allow' },

  // Reviews — 3 capabilities
  { action: 'reviews:review_own_completed_stay_or_order', role: 'owner', access: 'allow' },
  { action: 'reviews:review_own_completed_stay_or_order', role: 'guest', access: 'allow' },
  { action: 'reviews:review_own_completed_stay_or_order', role: 'resident', access: 'allow' },
  { action: 'reviews:review_own_completed_stay_or_order', role: 'buyer', access: 'allow' },

  { action: 'reviews:reply_publicly', role: 'staff_ops', access: 'allow' },
  { action: 'reviews:reply_publicly', role: 'onsite_host', access: 'allow' },
  { action: 'reviews:reply_publicly', role: 'mc_member', access: 'allow', scope: 'their_units' },
  { action: 'reviews:reply_publicly', role: 'provider_member', access: 'allow', scope: 'their_services' },

  // Admin panel — 4 capabilities
  { action: 'admin:grant_revoke_roles', role: 'staff_ops', access: 'allow', scope: 'guest_resident_own_projects' },
  { action: 'admin:grant_revoke_roles', role: 'mc_member', access: 'allow', scope: 'resident_their_project' },
  { action: 'admin:grant_revoke_roles', role: 'juristic_member', access: 'allow', scope: 'resident_their_project' },

  { action: 'admin:view_analytics_and_signals', role: 'staff_ops', access: 'read', scope: 'ops_metrics_own_projects' },
  { action: 'admin:view_analytics_and_signals', role: 'mc_member', access: 'read', scope: 'their_units_occupancy' },
  { action: 'admin:view_analytics_and_signals', role: 'juristic_member', access: 'read', scope: 'project_level_stats' },
];

interface CanContext {
  identity: Identity;
  action: string;
  resource?: {
    projectId?: string;
    unitId?: string;
    ownerId?: string;
    bookingId?: string;
    [key: string]: any;
  };
}

/**
 * Check if an identity can perform an action on a resource.
 *
 * Rules:
 * 1. If identity.status === 'blocked', deny everything
 * 2. If identity.is_admin, allow everything
 * 3. Otherwise, check role permissions against PERMISSIONS table
 */
export async function can(context: CanContext): Promise<boolean> {
  const { identity, action, resource } = context;

  // Rule 1: Blocked identities cannot do anything
  if (identity.status === 'blocked') {
    return false;
  }

  // Rule 2: Admins can do everything
  if (identity.isAdmin) {
    return true;
  }

  // Rule 3: Check role-based permissions
  const relevantPermissions = PERMISSIONS.filter((p) => p.action === action);

  if (relevantPermissions.length === 0) {
    // No permission entries for this action = deny by default
    return false;
  }

  // Get all active role assignments for this identity
  const roleAssignments = await prisma.roleAssignment.findMany({
    where: {
      identityId: identity.id,
      status: 'active',
    },
  });

  // For each role assignment, check if it permits this action
  for (const assignment of roleAssignments) {
    const matchingPermission = relevantPermissions.find((p) => p.role === assignment.role);

    if (!matchingPermission) {
      continue;
    }

    // Check scope matching
    if (!scopeMatches(assignment, resource)) {
      continue;
    }

    // If we reach here, this role/scope combo allows the action
    return true;
  }

  // No matching role/scope combo was found
  return false;
}

/**
 * Check if a role assignment's scope matches the resource being accessed.
 * Platform scope always matches. Project/unit scopes must match the resource.
 */
function scopeMatches(
  assignment: RoleAssignment,
  resource?: {
    projectId?: string;
    unitId?: string;
    [key: string]: any;
  }
): boolean {
  // Platform-scoped roles always match
  if (assignment.scopeType === 'platform') {
    return true;
  }

  // Project-scoped roles match if the resource is in that project
  if (assignment.scopeType === 'project') {
    if (!assignment.projectId || !resource?.projectId) {
      return false;
    }
    return assignment.projectId === resource.projectId;
  }

  // Unit-scoped roles match if the resource is in that unit
  if (assignment.scopeType === 'unit') {
    if (!assignment.unitId || !resource?.unitId) {
      return false;
    }
    return assignment.unitId === resource.unitId;
  }

  return false;
}

/**
 * Get all roles an identity holds in a given scope.
 */
export async function getIdentityRoles(
  identityId: string,
  scope?: { projectId?: string; unitId?: string }
): Promise<RoleType[]> {
  const where: any = {
    identityId,
    status: 'active',
  };

  if (scope?.projectId) {
    where.projectId = scope.projectId;
  }

  if (scope?.unitId) {
    where.unitId = scope.unitId;
  }

  const assignments = await prisma.roleAssignment.findMany({ where });
  return assignments.map((a) => a.role);
}

/**
 * Check if an identity holds a specific role in a scope.
 */
export async function hasRole(
  identityId: string,
  role: RoleType,
  scope?: { projectId?: string; unitId?: string }
): Promise<boolean> {
  const roles = await getIdentityRoles(identityId, scope);
  return roles.includes(role);
}
