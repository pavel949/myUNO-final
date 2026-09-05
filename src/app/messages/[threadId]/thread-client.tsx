'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

interface ThreadMessage {
  id: string;
  body: string | null;
  messageKind: string;
  createdAt: string;
  sender: { id: string; firstName: string; lastName: string } | null;
}

interface ThreadData {
  id: string;
  participants: {
    identityId: string;
    participantRole: string;
    identity: { id: string; firstName: string; lastName: string };
  }[];
  messages: ThreadMessage[];
}

type Labels = Record<string, string>;

export default function ThreadClient({
  threadId,
  labels,
}: {
  threadId: string;
  labels: Labels;
}) {
  const router = useRouter();
  const [thread, setThread] = useState<ThreadData | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  const [flaggingId, setFlaggingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/threads/${threadId}`);
    if (response.status === 401) {
      router.push(`/login?next=/messages/${threadId}`);
      return;
    }
    if (!response.ok) {
      setError(labels['messages.thread.not_found']);
      setLoading(false);
      return;
    }
    const data = await response.json();
    setThread(data.thread);
    setLoading(false);
  }, [threadId, router, labels]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000); // light polling until SSE lands
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const inferMe = async () => {
      const response = await fetch('/api/auth/me').catch(() => null);
      if (response?.ok) {
        const data = await response.json();
        setMyId(data.id);
        const staffRoles = new Set(['staff_ops', 'onsite_host']);
        setIsStaff(
          Boolean(data.isAdmin) ||
            (Array.isArray(data.roles) && data.roles.some((r: string) => staffRoles.has(r)))
        );
      }
    };
    inferMe();
  }, []);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch(`/api/threads/${threadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: draft }),
      });
      if (!response.ok) throw new Error(labels['messages.thread.error_generic']);
      setDraft('');
      await load();
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['messages.thread.error_generic']);
    } finally {
      setSending(false);
    }
  };

  const flagPurchase = async (messageId: string) => {
    setFlaggingId(messageId);
    setError(null);
    try {
      const response = await fetch(`/api/messages/${messageId}/flag-as-purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || labels['messages.thread.error_generic']);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['messages.thread.error_generic']);
    } finally {
      setFlaggingId(null);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-surface-background p-32">
        <p className="text-body text-text-secondary text-center">
          {labels['messages.thread.loading']}
        </p>
      </main>
    );
  }

  if (!thread) {
    return (
      <main className="min-h-screen bg-surface-background p-32">
        <div className="max-w-2xl mx-auto">
          <p className="text-body text-state-error mb-16">
            {error || labels['messages.thread.not_found']}
          </p>
          <Link href="/messages" className="text-brand-andaman font-semibold hover:underline">
            {labels['messages.thread.back']}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface-background p-24 md:p-32">
      <div className="max-w-2xl mx-auto flex flex-col" style={{ minHeight: '80vh' }}>
        <p className="mb-16">
          <Link href="/messages" className="text-brand-andaman font-semibold hover:underline">
            {labels['messages.thread.back']}
          </Link>
        </p>

        <div className="flex-1 bg-surface-paper border border-border-line rounded-lg p-16 mb-16 overflow-y-auto space-y-12">
          {thread.messages.map((message) => {
            const mine = myId !== null && message.sender?.id === myId;
            if (message.messageKind === 'system') {
              return (
                <p key={message.id} className="text-small text-text-stone text-center">
                  {message.body}
                </p>
              );
            }
            return (
              <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-16 py-8 ${
                    mine
                      ? 'bg-state-info-soft text-text-ink'
                      : 'bg-surface-ivory text-text-ink'
                  }`}
                >
                  {!mine && message.sender && (
                    <p className="text-small font-semibold text-brand-andaman">
                      {message.sender.firstName} {message.sender.lastName}
                    </p>
                  )}
                  <p className="text-body whitespace-pre-wrap">{message.body}</p>
                  <div className="flex items-center justify-between gap-8 mt-4 flex-wrap">
                    <p className="text-small text-text-stone">
                      {new Date(message.createdAt).toLocaleString()}
                    </p>
                    {isStaff && !mine && message.sender ? (
                      <button
                        type="button"
                        className="text-small text-brand-andaman hover:underline disabled:opacity-50"
                        onClick={() => flagPurchase(message.id)}
                        disabled={flaggingId === message.id}
                      >
                        {flaggingId === message.id
                          ? labels['messages.thread.flag_working']
                          : labels['messages.thread.flag_purchase']}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {error && <p className="text-small text-state-error mb-8">{error}</p>}

        <form onSubmit={send} className="flex gap-8">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={labels['messages.thread.placeholder']}
            className="flex-1 h-48 px-16 rounded-sm bg-surface-paper border border-border-line text-text-ink focus:border-brand-andaman focus:outline-none"
          />
          <Button type="submit" isLoading={sending} disabled={!draft.trim()}>
            {labels['messages.thread.send']}
          </Button>
        </form>
      </div>
    </main>
  );
}
