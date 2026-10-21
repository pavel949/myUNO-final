'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { editorLabel, type PropertyEditorCopy } from '@/modules/content/property-editor.seed';

/** Guard native exits, in-app links and supported browser traversals. */
export function useUnsavedProperty(copy: PropertyEditorCopy) {
  const dirty = useRef(false);
  useEffect(() => {
    const leave = () => !dirty.current || window.confirm(editorLabel(copy, 'leave'));
    const unload = (event: BeforeUnloadEvent) => {
      if (dirty.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    const click = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = (event.target as Element)?.closest?.('a[href]');
      if (!link || link.getAttribute('target') === '_blank' || link.hasAttribute('download'))
        return;
      const url = new URL((link as HTMLAnchorElement).href, window.location.href);
      if (url.href !== window.location.href && !leave()) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    // Navigation API can cancel browser back/forward before Next consumes the
    // traversal. Other browsers still have the native unload and link guards.
    const navigation = (window as unknown as { navigation?: EventTarget }).navigation;
    const traverse = (event: Event) => {
      if (
        (event as Event & { navigationType?: string }).navigationType === 'traverse' &&
        event.cancelable &&
        !leave()
      )
        event.preventDefault();
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', click, true);
    navigation?.addEventListener('navigate', traverse);
    return () => {
      window.removeEventListener('beforeunload', unload);
      document.removeEventListener('click', click, true);
      navigation?.removeEventListener('navigate', traverse);
    };
  }, [copy]);
  return dirty;
}
export function usePropertyEdit(copy: PropertyEditorCopy, initialVersion: string) {
  const router = useRouter();
  const dirty = useUnsavedProperty(copy);
  const pending = useRef(false);
  const editCount = useRef(0);
  const version = useRef(initialVersion);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [conflict, setConflict] = useState(false);
  const save = async (path: string, method: string, body: object) => {
    if (pending.current || conflict) return false;
    pending.current = true;
    const submittedEditCount = editCount.current;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, expectedUpdatedAt: version.current }),
      });
      const payload = await response.json();
      if (response.status === 409) {
        setConflict(true);
        setMessage(editorLabel(copy, 'conflict'));
        return false;
      }
      if (!response.ok) throw new Error('save_failed');
      version.current = payload.updatedAt;
      dirty.current = editCount.current !== submittedEditCount;
      setMessage(editorLabel(copy, dirty.current ? 'saved_pending' : 'saved'));
      router.refresh();
      return true;
    } catch {
      setMessage(editorLabel(copy, 'failed'));
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const reload = () => {
    if (!dirty.current || window.confirm(editorLabel(copy, 'leave'))) {
      dirty.current = false;
      window.location.reload();
    }
  };
  return {
    busy,
    message,
    conflict,
    save,
    reload,
    changed: () => {
      dirty.current = true;
      editCount.current += 1;
    },
  };
}
