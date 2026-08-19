import { PrismaClient, NotificationType, NotificationChannel } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { logAudit } from '@/modules/audit';

/**
 * A person's own account: who they are, how they sign in, and what reaches them.
 *
 * None of this existed. There was no surface anywhere for a guest, an owner or a
 * staff member to change their name, switch language, set a new password, or
 * turn a notification off — while `NotificationPreference` sat in the schema and
 * doc 11 specified per-type mutes. For a platform under the PDPA that last one
 * is the sharp end: consent a person cannot withdraw is not consent.
 *
 * Everything here is scoped to the caller's own identity by construction. There
 * is no `identityId` parameter that an admin could pass to edit someone else —
 * a person's own account is exactly that, and administering other people is a
 * different surface with a different permission (doc 03).
 */

const BCRYPT_COST = 12;

/** Locales the platform speaks (doc 05 §2). A person cannot choose a fourth. */
export const SUPPORTED_LOCALES = ['en', 'ru', 'th'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export interface AccountProfile {
  identityId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  emailVerified: boolean;
  phone: string | null;
  phoneVerified: boolean;
  preferredLocale: string;
  /** False for an identity created by staff that has never set a password. */
  hasPassword: boolean;
}

export async function getAccountProfile(
  db: PrismaClient,
  identityId: string
): Promise<AccountProfile | null> {
  const identity = await db.identity.findUnique({
    where: { id: identityId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      emailVerifiedAt: true,
      phone: true,
      phoneVerifiedAt: true,
      preferredLocale: true,
      hashedPassword: true,
    },
  });
  if (!identity) return null;

  return {
    identityId: identity.id,
    firstName: identity.firstName,
    lastName: identity.lastName,
    email: identity.email,
    emailVerified: identity.emailVerifiedAt !== null,
    phone: identity.phone,
    phoneVerified: identity.phoneVerifiedAt !== null,
    preferredLocale: identity.preferredLocale,
    // The hash itself never leaves this function.
    hasPassword: Boolean(identity.hashedPassword),
  };
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  preferredLocale?: string;
}

/**
 * Change the parts of a profile a person owns outright.
 *
 * Email and phone are deliberately **not** here. Both are verified identifiers
 * and both are how an account is recovered, so changing one is a flow with a
 * confirmation step (doc 07 F-AUTH-3), not a field edit. Letting it happen here
 * would let anyone who borrows a logged-in session move the account to an
 * address they control.
 */
export async function updateAccountProfile(
  db: PrismaClient,
  identityId: string,
  input: UpdateProfileInput
) {
  const data: Record<string, string> = {};

  if (input.firstName !== undefined) {
    const firstName = input.firstName.trim();
    if (!firstName) throw new Error('A first name cannot be empty');
    data.firstName = firstName;
  }
  if (input.lastName !== undefined) {
    const lastName = input.lastName.trim();
    if (!lastName) throw new Error('A last name cannot be empty');
    data.lastName = lastName;
  }
  if (input.preferredLocale !== undefined) {
    if (!SUPPORTED_LOCALES.includes(input.preferredLocale as SupportedLocale)) {
      throw new Error(`Unsupported locale: ${input.preferredLocale}`);
    }
    data.preferredLocale = input.preferredLocale;
  }

  if (Object.keys(data).length === 0) {
    throw new Error('Nothing to update');
  }

  const updated = await db.identity.update({ where: { id: identityId }, data });

  await logAudit({
    actorIdentityId: identityId,
    action: 'account:update_profile',
    entityType: 'Identity',
    entityId: identityId,
    // The changed field names, never their values: a name is personal data and
    // doc 12 keeps PII out of logs.
    data: { fields: Object.keys(data) },
  }).catch(() => null);

  return updated;
}

/**
 * Change a password, proving the current one first.
 *
 * Requiring the old password is what separates this from the reset flow. A
 * borrowed session should not be enough to lock the real owner out.
 */
export async function changeAccountPassword(
  db: PrismaClient,
  identityId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ changed: true }> {
  if (newPassword.length < 8) {
    throw new Error('A password must be at least 8 characters');
  }

  const identity = await db.identity.findUnique({
    where: { id: identityId },
    select: { hashedPassword: true },
  });
  if (!identity?.hashedPassword) {
    throw new Error('This account has no password set. Use the reset link instead.');
  }

  const matches = await bcrypt.compare(currentPassword, identity.hashedPassword);
  if (!matches) {
    const err = new Error('The current password is not correct');
    (err as { code?: string }).code = 'WRONG_PASSWORD';
    throw err;
  }

  if (await bcrypt.compare(newPassword, identity.hashedPassword)) {
    throw new Error('The new password must differ from the current one');
  }

  await db.identity.update({
    where: { id: identityId },
    data: { hashedPassword: await bcrypt.hash(newPassword, BCRYPT_COST) },
  });

  await logAudit({
    actorIdentityId: identityId,
    action: 'account:change_password',
    entityType: 'Identity',
    entityId: identityId,
    data: {},
  }).catch(() => null);

  return { changed: true };
}

// --- Notification preferences --------------------------------------------

export interface NotificationSetting {
  type: NotificationType;
  channel: NotificationChannel;
  muted: boolean;
}

/**
 * What reaches this person, per type and channel.
 *
 * Returns a row for every combination, not only the ones stored. A preference
 * that has never been touched is *not muted*, and a screen that only listed
 * stored rows would show an empty page to everyone who had never changed
 * anything — which is everyone, at first.
 */
export async function getNotificationSettings(
  db: PrismaClient,
  identityId: string,
  types: readonly NotificationType[],
  channels: readonly NotificationChannel[]
): Promise<NotificationSetting[]> {
  const stored = await db.notificationPreference.findMany({ where: { identityId } });
  const mutedSet = new Set(
    stored.filter((p) => p.muted).map((p) => `${p.type}:${p.channel}`)
  );

  return types.flatMap((type) =>
    channels.map((channel) => ({
      type,
      channel,
      muted: mutedSet.has(`${type}:${channel}`),
    }))
  );
}

/**
 * Mute or unmute one type on one channel.
 *
 * Some notifications cannot be muted, and that is deliberate rather than an
 * oversight: doc 11 marks the ones a person must receive because they carry an
 * obligation or a payment. A guest silencing their own TM30 request would leave
 * the operator in breach of a 24-hour legal deadline on their behalf.
 */
export const UNMUTABLE_TYPES: readonly NotificationType[] = [
  'stay_verification_failed',
  'compliance_tm30_escalation',
];

export async function setNotificationPreference(
  db: PrismaClient,
  identityId: string,
  type: NotificationType,
  channel: NotificationChannel,
  muted: boolean
) {
  if (muted && UNMUTABLE_TYPES.includes(type)) {
    const err = new Error(
      'This notification cannot be turned off: it carries a legal or payment obligation'
    );
    (err as { code?: string }).code = 'UNMUTABLE';
    throw err;
  }

  const saved = await db.notificationPreference.upsert({
    where: { identityId_type_channel: { identityId, type, channel } },
    update: { muted },
    create: { identityId, type, channel, muted },
  });

  // A consent change is exactly the kind of thing that must be provable later
  // (doc 12 §6). Type and channel are not personal data; the person is the actor.
  await logAudit({
    actorIdentityId: identityId,
    action: muted ? 'account:mute_notification' : 'account:unmute_notification',
    entityType: 'NotificationPreference',
    entityId: saved.id,
    data: { type, channel },
  }).catch(() => null);

  return saved;
}
