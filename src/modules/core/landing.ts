import { RoleType } from '@prisma/client';

/**
 * Where a person belongs when they arrive with no particular destination.
 *
 * Doc 08 §5 specifies `/app` as an adaptive landing. It did not exist, so where
 * somebody ended up depended on which link they had last been sent — an owner
 * who typed the bare domain got the public marketing site, and a resident got
 * it too, because they had nowhere else to be.
 *
 * A pure function on purpose: the routing rule is a policy decision worth
 * reading and worth testing, and none of it needs a database.
 */

export interface LandingContext {
  isAdmin: boolean;
  roles: readonly RoleType[];
  /** A stay that is under way right now — checked in, or inside its dates. */
  activeBookingId?: string | null;
  /** When the owner holds exactly one unit, land on its dashboard (doc 06 S7). */
  ownerUnitId?: string | null;
}

export interface Landing {
  path: string;
  /** Which fact decided it, so the UI can explain the choice if it wants to. */
  reason:
    | 'active_stay'
    | 'admin'
    | 'staff'
    | 'management_company'
    | 'juristic'
    | 'provider'
    | 'owner'
    | 'resident'
    | 'buyer'
    | 'public';
}

/**
 * The order below is the whole of the policy, so it is written as a list rather
 * than buried in branches.
 *
 * **An active stay wins over everything.** Somebody who is in a bed tonight
 * needs the door code, not a portfolio: it is the most time-bound context a
 * person can be in, and it ends by itself in a few days. An owner staying in
 * their own unit still lands on the stay — the role banner on that page already
 * offers them the owner dashboard, so nothing is lost.
 *
 * After that it descends by how much of the platform the role is responsible
 * for: running it, operating a project, operating an organisation's units,
 * fulfilling orders, owning an asset, living somewhere.
 *
 * `buyer` sits last among the roles. Someone who is both an owner and a buyer is
 * an owner first: the asset they already hold has money moving through it every
 * month, and the one they are considering does not.
 */
const PRECEDENCE: { role: RoleType; path: string; reason: Landing['reason'] }[] = [
  { role: 'staff_ops', path: '/ops', reason: 'staff' },
  { role: 'onsite_host', path: '/ops', reason: 'staff' },
  { role: 'mc_member', path: '/mc', reason: 'management_company' },
  { role: 'juristic_member', path: '/juristic', reason: 'juristic' },
  { role: 'provider_member', path: '/provider', reason: 'provider' },
  { role: 'owner', path: '/owner', reason: 'owner' },
  { role: 'resident', path: '/residence', reason: 'resident' },
  { role: 'buyer', path: '/buying', reason: 'buyer' },
];

export function resolveLanding(context: LandingContext): Landing {
  if (context.activeBookingId) {
    return {
      path: `/bookings/${context.activeBookingId}/home-space`,
      reason: 'active_stay',
    };
  }

  if (context.isAdmin) {
    return { path: '/app/admin', reason: 'admin' };
  }

  const held = new Set(context.roles);
  for (const entry of PRECEDENCE) {
    if (held.has(entry.role)) {
      if (entry.role === 'owner' && context.ownerUnitId) {
        return {
          path: `/owner/units/${context.ownerUnitId}`,
          reason: entry.reason,
        };
      }
      return { path: entry.path, reason: entry.reason };
    }
  }

  // A guest between stays, a buyer, or somebody with no role yet. Search is
  // where they can actually do something, and it is not a dead end.
  return { path: '/search', reason: 'public' };
}

/**
 * Every surface a person can reach, for the switcher on the landing page.
 *
 * Someone wearing several hats should be able to see the others rather than
 * being silently routed to one of them forever. Returned in the same order as
 * the precedence above so the list reads consistently.
 */
export function availableSurfaces(context: LandingContext): Landing[] {
  const surfaces: Landing[] = [];

  if (context.activeBookingId) {
    surfaces.push({
      path: `/bookings/${context.activeBookingId}/home-space`,
      reason: 'active_stay',
    });
  }
  if (context.isAdmin) {
    surfaces.push({ path: '/app/admin', reason: 'admin' });
  }

  const held = new Set(context.roles);
  const seen = new Set(surfaces.map((s) => s.path));
  for (const entry of PRECEDENCE) {
    // staff_ops and onsite_host both land on the ops board; listing it twice
    // would suggest there are two of them.
    if (held.has(entry.role)) {
      const path =
        entry.role === 'owner' && context.ownerUnitId
          ? `/owner/units/${context.ownerUnitId}`
          : entry.path;
      if (!seen.has(path)) {
        surfaces.push({ path, reason: entry.reason });
        seen.add(path);
      }
    }
  }

  return surfaces;
}
