'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AccountProfile } from '@/modules/core';

interface Setting {
  type: string;
  channel: string;
  muted: boolean;
}

export default function AccountClient({
  profile,
  labels,
}: {
  profile: AccountProfile;
  labels: Record<string, string>;
}) {
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [locale, setLocale] = useState(profile.preferredLocale);
  const [profileState, setProfileState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  const [settings, setSettings] = useState<Setting[]>([]);
  const [unmutable, setUnmutable] = useState<string[]>([]);
  const [notificationError, setNotificationError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/account/notifications')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setSettings(data.settings ?? []);
        setUnmutable(data.unmutable ?? []);
      })
      .catch(() => setNotificationError(labels['account.error']));
  }, [labels]);

  const saveProfile = useCallback(async () => {
    setProfileState('saving');
    const res = await fetch('/api/account/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, preferredLocale: locale }),
    }).catch(() => null);
    setProfileState(res?.ok ? 'saved' : 'error');
  }, [firstName, lastName, locale]);

  const changePassword = useCallback(async () => {
    setPasswordMessage(null);
    const res = await fetch('/api/account/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    }).catch(() => null);
    if (res?.ok) {
      setPasswordMessage(labels['account.password.changed']);
      setCurrentPassword('');
      setNewPassword('');
      return;
    }
    const body = await res?.json().catch(() => null);
    setPasswordMessage(body?.error ?? labels['account.error']);
  }, [currentPassword, newPassword, labels]);

  const toggle = useCallback(
    async (type: string, channel: string, muted: boolean) => {
      setNotificationError(null);
      // Optimistic: a switch that waits for a round trip feels broken.
      setSettings((prev) =>
        prev.map((s) => (s.type === type && s.channel === channel ? { ...s, muted } : s))
      );
      const res = await fetch('/api/account/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, channel, muted }),
      }).catch(() => null);
      if (!res?.ok) {
        const body = await res?.json().catch(() => null);
        setNotificationError(body?.error ?? labels['account.error']);
        // Put it back: the server refused, so the switch must not lie.
        setSettings((prev) =>
          prev.map((s) => (s.type === type && s.channel === channel ? { ...s, muted: !muted } : s))
        );
        return;
      }
      const body = await res.json();
      setSettings(body.settings ?? []);
    },
    [labels]
  );

  const types = Array.from(new Set(settings.map((s) => s.type)));

  return (
    <div className="min-h-screen bg-surface-background p-24 md:p-32">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-heading-1 font-bold text-text-ink mb-24">{labels['account.title']}</h1>

        <section className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24">
          <h2 className="text-heading-3 font-semibold text-text-ink mb-16">
            {labels['account.profile.title']}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mb-16">
            <label className="block">
              <span className="text-small text-text-secondary">{labels['account.profile.first_name']}</span>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-4 w-full h-48 rounded-sm border border-border-line bg-surface-background px-12 text-body text-text-ink"
              />
            </label>
            <label className="block">
              <span className="text-small text-text-secondary">{labels['account.profile.last_name']}</span>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-4 w-full h-48 rounded-sm border border-border-line bg-surface-background px-12 text-body text-text-ink"
              />
            </label>
          </div>

          <label className="block mb-16">
            <span className="text-small text-text-secondary">{labels['account.locale.title']}</span>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              className="mt-4 w-full h-48 rounded-sm border border-border-line bg-surface-background px-12 text-body text-text-ink"
            >
              <option value="en">{labels['account.locale.en']}</option>
              <option value="ru">{labels['account.locale.ru']}</option>
              <option value="th">{labels['account.locale.th']}</option>
            </select>
          </label>

          <p className="text-small text-text-secondary mb-16">
            {labels['account.profile.email']}: {profile.email ?? '—'}{' '}
            <span className={profile.emailVerified ? 'text-state-success' : 'text-text-secondary'}>
              ({profile.emailVerified ? labels['account.profile.verified'] : labels['account.profile.unverified']})
            </span>
            <br />
            {labels['account.profile.phone']}: {profile.phone ?? '—'}
            <br />
            <span className="italic">{labels['account.profile.contact_note']}</span>
          </p>

          <button
            type="button"
            onClick={saveProfile}
            disabled={profileState === 'saving'}
            className="h-48 px-24 rounded-sm bg-brand-andaman text-surface-ivory font-semibold hover:opacity-90 transition disabled:opacity-50"
          >
            {profileState === 'saving' ? labels['account.saving'] : labels['account.save']}
          </button>
          {profileState === 'saved' && (
            <span className="ml-12 text-small text-state-success">{labels['account.saved']}</span>
          )}
          {profileState === 'error' && (
            <span className="ml-12 text-small text-state-error">{labels['account.error']}</span>
          )}
        </section>

        <section className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24">
          <h2 className="text-heading-3 font-semibold text-text-ink mb-16">
            {labels['account.password.title']}
          </h2>
          {profile.hasPassword ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mb-16">
                <label className="block">
                  <span className="text-small text-text-secondary">{labels['account.password.current']}</span>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="mt-4 w-full h-48 rounded-sm border border-border-line bg-surface-background px-12 text-body text-text-ink"
                  />
                </label>
                <label className="block">
                  <span className="text-small text-text-secondary">{labels['account.password.new']}</span>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="mt-4 w-full h-48 rounded-sm border border-border-line bg-surface-background px-12 text-body text-text-ink"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={changePassword}
                disabled={!currentPassword || !newPassword}
                className="h-48 px-24 rounded-sm border border-brand-andaman text-brand-andaman font-semibold hover:bg-brand-andaman/10 transition disabled:opacity-50"
              >
                {labels['account.password.submit']}
              </button>
              {passwordMessage && (
                <p className="mt-12 text-small text-text-secondary">{passwordMessage}</p>
              )}
            </>
          ) : (
            <p className="text-body text-text-secondary">{labels['account.password.none']}</p>
          )}
        </section>

        <section className="bg-surface-paper border border-border-line rounded-lg p-24">
          <h2 className="text-heading-3 font-semibold text-text-ink mb-8">
            {labels['account.notifications.title']}
          </h2>
          <p className="text-small text-text-secondary mb-16">
            {labels['account.notifications.intro']}
          </p>
          {notificationError && (
            <p className="text-small text-state-error mb-16">{notificationError}</p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-small">
              <tbody>
                {types.map((type) => {
                  const required = unmutable.includes(type);
                  return (
                    <tr key={type} className="border-t border-border-line">
                      <td className="py-12 pr-16 text-text-ink">{type}</td>
                      {['in_app', 'email'].map((channel) => {
                        const setting = settings.find((s) => s.type === type && s.channel === channel);
                        return (
                          <td key={channel} className="py-12 px-8 whitespace-nowrap">
                            <label className="inline-flex items-center gap-8 text-text-secondary">
                              <input
                                type="checkbox"
                                checked={!setting?.muted}
                                disabled={required}
                                onChange={(e) => toggle(type, channel, !e.target.checked)}
                              />
                              {channel === 'in_app'
                                ? labels['account.notifications.in_app']
                                : labels['account.notifications.email']}
                            </label>
                          </td>
                        );
                      })}
                      <td className="py-12 pl-8 text-text-secondary">
                        {required && (
                          <span title={labels['account.notifications.required_why']}>
                            {labels['account.notifications.required']}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
