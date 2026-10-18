'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ComponentProps,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import {
  resolveWorkspaceNavigation,
  isWorkspaceTabActive,
  scopedWorkspaceHref,
  type WorkspaceMode,
  type WorkspaceNavigationContext,
  type WorkspaceTab,
} from '@/lib/workspace-navigation';

export type WorkspaceNavigationLabels = Record<string, string>;

interface Selection {
  mode: WorkspaceMode;
  optionId?: string;
}

interface StoredSelection extends Selection {
  identityKey: string | null;
}

type ResolvedNavigation = ReturnType<typeof resolveWorkspaceNavigation>;
interface WorkspaceNavigationValue extends ResolvedNavigation {
  context: WorkspaceNavigationContext;
  labels: WorkspaceNavigationLabels;
  pathname: string;
  search: string;
  selectWorkspace: (mode: WorkspaceMode, optionId?: string) => void;
  frameRef: RefObject<HTMLDivElement>;
}

const NavigationContext = createContext<WorkspaceNavigationValue | null>(null);
const FOCUS_STYLE = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-andaman';

/** Stores a display preference only. Scopes and permissions never enter storage. */
export function workspaceSelectionStorageKey(identityKey: string | null) {
  return `myuno.workspace.v1:${encodeURIComponent(identityKey ?? 'anonymous')}`;
}

function validSelection(value: unknown, context: WorkspaceNavigationContext): Selection | null {
  if (!value || typeof value !== 'object') return null;
  const { mode, optionId } = value as Partial<Selection>;
  if (mode === 'personal') return { mode };
  if (mode !== 'property' && mode !== 'services') return null;
  const options = mode === 'property' ? context.propertyOptions : context.serviceOptions;
  return typeof optionId === 'string' && options.some((option) => option.id === optionId)
    ? { mode, optionId }
    : null;
}

function readSelection(context: WorkspaceNavigationContext): Selection | null {
  try {
    const saved = window.localStorage.getItem(workspaceSelectionStorageKey(context.identityKey));
    return saved ? validSelection(JSON.parse(saved), context) : null;
  } catch {
    // Private browsing and blocked storage still allow in-memory switching.
    return null;
  }
}

function writeSelection(context: WorkspaceNavigationContext, selection: Selection | null) {
  try {
    const key = workspaceSelectionStorageKey(context.identityKey);
    if (selection) window.localStorage.setItem(key, JSON.stringify(selection));
    else window.localStorage.removeItem(key);
  } catch {
    // Persistence is optional; it is never an authorization dependency.
  }
}

export function WorkspaceNavigationProvider({ context, labels, children }: {
  context: WorkspaceNavigationContext;
  labels: WorkspaceNavigationLabels;
  children: ReactNode;
}) {
  const pathname = usePathname() || '/';
  const search = useSearchParams()?.toString() || '';
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const previousPath = useRef(pathname);
  const frameRef = useRef<HTMLDivElement>(null);
  const [stored, setStored] = useState<StoredSelection | null>(null);
  const preference = stored?.identityKey === context.identityKey
    ? validSelection(stored, context)
    : null;

  // App-router layouts persist. Request fresh server-projected navigation after
  // navigation and returning to the tab; destination guards remain authoritative.
  useEffect(() => {
    if (previousPath.current !== pathname) {
      previousPath.current = pathname;
      routerRef.current.refresh();
    }
  }, [pathname]);
  useEffect(() => {
    const refresh = () => routerRef.current.refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  useEffect(() => {
    const load = () => {
      const selection = readSelection(context);
      setStored(selection ? { ...selection, identityKey: context.identityKey } : null);
      // Drop revoked/stale preferences instead of keeping them for a future login.
      if (!selection) writeSelection(context, null);
    };
    load();
    const onStorage = (event: StorageEvent) => {
      if (event.key === workspaceSelectionStorageKey(context.identityKey) || event.key === null) load();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [context]);

  const resolved = useMemo(() => resolveWorkspaceNavigation(context, {
    pathname,
    search,
    preferredMode: preference?.mode,
    preferredOptionId: preference?.optionId,
  }), [context, pathname, search, preference?.mode, preference?.optionId]);

  const selectWorkspace = useCallback((mode: WorkspaceMode, optionId?: string) => {
    if (!resolved.availableModes.includes(mode)) return;
    const options = mode === 'property' ? context.propertyOptions : context.serviceOptions;
    const option = mode === 'personal' ? null : options.find((item) => item.id === optionId)
      || options.find((item) => item.id === preference?.optionId)
      || options[0];
    if (mode !== 'personal' && !option) return;
    const selection: Selection = option ? { mode, optionId: option.id } : { mode };
    setStored({ ...selection, identityKey: context.identityKey });
    writeSelection(context, selection);
    // A workspace change is explicit navigation, never a role or grant change.
    if (mode === resolved.mode && option?.id === resolved.option?.id && !resolved.controlPlane) return;
    const personal = resolveWorkspaceNavigation(context, { pathname: '/trips', preferredMode: 'personal' });
    const target = option?.href || personal.tabs.find((tab) => tab.id === 'my')?.href
      || personal.tabs.find((tab) => tab.href)?.href;
    if (target) router.push(target);
  }, [context, preference?.optionId, resolved, router]);

  const value = useMemo(() => ({
    ...resolved, context, labels, pathname, search, selectWorkspace, frameRef,
  }), [resolved, context, labels, pathname, search, selectWorkspace]);

  return (
    <NavigationContext.Provider value={value}>
      <div ref={frameRef} className="workspace-navigation-context min-w-0 flex-1">
        {children}
      </div>
    </NavigationContext.Provider>
  );
}

export function useOptionalWorkspaceNavigation() {
  return useContext(NavigationContext);
}

export function useWorkspaceNavigation() {
  const value = useOptionalWorkspaceNavigation();
  if (!value) throw new Error('WorkspaceNavigationProvider is required');
  return value;
}

/** Shared inbox/thread links retain validated display context, never permissions. */
export function WorkspaceContextLink({ href, ...props }: Omit<ComponentProps<typeof Link>, 'href'> & { href: string }) {
  const navigation = useOptionalWorkspaceNavigation();
  const path = href.split(/[?#]/)[0];
  const shared = path === '/messages' || path.startsWith('/messages/');
  let scoped = href;
  if (shared && navigation && !navigation.controlPlane) {
    if (navigation.mode !== 'personal' && navigation.option) {
      scoped = scopedWorkspaceHref(href, navigation.option, navigation.search, navigation.mode);
    } else if (navigation.mode === 'personal') {
      const [target, fragment] = href.split('#');
      const [pathname, query = ''] = target.split('?');
      const params = new URLSearchParams(query);
      // A personal conversation must not reactivate a previously stored work
      // preference or inherit work scope from a stale target URL.
      for (const key of ['workspaceOption', 'projectId', 'organizationId', 'spaceId', 'unitId', 'mc']) params.delete(key);
      params.set('workspace', 'personal');
      scoped = `${pathname}?${params.toString()}${fragment ? `#${fragment}` : ''}`;
    }
  }
  return <Link prefetch={false} {...props} href={scoped} />;
}

function useMeasuredHeight(ref: RefObject<HTMLElement>, property: string, visible = true) {
  const { frameRef } = useWorkspaceNavigation();
  useEffect(() => {
    const frame = frameRef.current;
    const element = ref.current;
    if (!frame) return;
    const measure = () => frame.style.setProperty(property,
      `${visible && element ? Math.ceil(element.getBoundingClientRect().height) : 0}px`);
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (element) observer?.observe(element);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      frame.style.removeProperty(property);
    };
  }, [frameRef, property, ref, visible]);
}

/** Explicit, persistent mode control on both mobile and desktop. */
export function WorkspaceSwitcher() {
  const { availableModes, mode, option, context, labels, controlPlane, selectWorkspace } = useWorkspaceNavigation();
  const ref = useRef<HTMLElement>(null);
  const selectId = useId();
  useMeasuredHeight(ref, '--workspace-switcher-height');
  const options = mode === 'property' ? context.propertyOptions : mode === 'services' ? context.serviceOptions : [];
  const optionLabel = labels[mode === 'services' ? 'workspace.chooseServices' : 'workspace.chooseProperty'];

  return (
    <nav
      ref={ref}
      aria-label={labels['workspace.switcher']}
      className="sticky z-30 border-b border-border-line bg-surface-ivory/95 backdrop-blur-xl"
      style={{ top: 'var(--nav-height, 64px)' }}
    >
      <div className="mx-auto flex max-w-content flex-wrap items-center gap-x-16 gap-y-8 px-16 py-8 md:px-24">
        <div className="flex min-w-0 flex-1 gap-4 md:flex-none" role="group" aria-label={labels['workspace.switcher']}>
          {availableModes.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={!controlPlane && mode === item}
              onClick={() => selectWorkspace(item)}
              className={`min-h-44 min-w-0 flex-1 rounded-md px-12 py-8 text-small font-semibold transition-colors duration-micro motion-reduce:transition-none md:flex-none ${FOCUS_STYLE} ${!controlPlane && mode === item
                ? 'bg-brand-andaman text-surface-ivory'
                : 'text-text-ink hover:bg-surface-subtle'}`}
            >
              {labels[`workspace.${item}`]}
            </button>
          ))}
        </div>
        {controlPlane && context.controlPlane ? (
          <span className="text-small font-semibold text-text-secondary">{labels[context.controlPlane.labelKey]}</span>
        ) : options.length > 1 ? (
          <div className="flex w-full min-w-0 items-center gap-8 md:w-auto md:flex-1">
            <label htmlFor={selectId} className="sr-only">{optionLabel}</label>
            <select
              id={selectId}
              value={option?.id || ''}
              onChange={(event) => selectWorkspace(mode, event.target.value)}
              className={`min-h-44 w-full min-w-0 rounded-md border border-border-line bg-surface-paper px-12 py-8 text-small text-text-ink md:max-w-[320px] ${FOCUS_STYLE}`}
            >
              {options.map((item) => <option key={item.id} value={item.id}>
                {labels[item.labelKey]}{item.scopeName ? ` · ${item.scopeName}` : ''}
              </option>)}
            </select>
          </div>
        ) : option ? (
          <span className="min-w-0 text-small text-text-secondary">
            {labels[option.labelKey]}{option.scopeName ? ` · ${option.scopeName}` : ''}
          </span>
        ) : null}
      </div>
    </nav>
  );
}

const ICONS: Record<string, string> = {
  explore: 'M12 3a9 9 0 100 18 9 9 0 000-18zm3.5 5.5l-2 5-5 2 2-5 5-2z',
  saved: 'M7 4h10v16l-5-3-5 3V4z',
  my: 'M4 20V9l8-5 8 5v11M9 20v-6h6v6',
  messages: 'M21 11.5a8 8 0 01-8 8H4l-2 2V11.5a9.5 9.5 0 0119 0z',
  profile: 'M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 0114 0',
  today: 'M8 3v4m8-4v4M4 10h16M5 5h14a1 1 0 011 1v14H4V6a1 1 0 011-1zm3 9l3 3 5-5',
  calendar: 'M8 3v4m8-4v4M4 10h16M5 5h14a1 1 0 011 1v14H4V6a1 1 0 011-1zM8 14h2m4 0h2m-8 3h2',
  properties: 'M3 21V8l8-5v18M11 9h10v12M6 9h2m-2 4h2m-2 4h2m7-4h2m-2 4h2M2 21h20',
  more: 'M5 11a1 1 0 100 2 1 1 0 000-2zm7 0a1 1 0 100 2 1 1 0 000-2zm7 0a1 1 0 100 2 1 1 0 000-2z',
  orders: 'M7 4h10l3 5v11H4V9l3-5zm-3 5h16M9 13h6m-6 4h4',
  services: 'M3 17h18M5 17a7 7 0 0114 0M12 7V5',
  earnings: 'M3 7h18v13H3V7zm0 0V4h15v3M16 12h5v4h-5v-4z',
};

function NavigationIcon({ id }: { id: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-24 w-24 shrink-0" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[id] || ICONS.more} />
    </svg>
  );
}

type SheetState = { tab: WorkspaceTab; trigger: HTMLElement } | null;

export function WorkspaceTabs() {
  const navigation = useWorkspaceNavigation();
  const { tabs, more, labels, controlPlane, pathname, search, mode, option } = navigation;
  const ref = useRef<HTMLElement>(null);
  const [sheet, setSheet] = useState<SheetState>(null);
  const dialogId = useId();
  useMeasuredHeight(ref, '--workspace-tab-height', !controlPlane);
  useEffect(() => setSheet(null), [pathname, search, mode, option?.id]);
  const close = useCallback(() => setSheet(null), []);
  if (controlPlane || tabs.length === 0) return null;
  // A refreshed context can revoke/change a destination while its sheet is open.
  // Render only the current server-bounded tab, never its stale click snapshot.
  const currentSheetTab = sheet ? tabs.find((tab) => tab.id === sheet.tab.id && !tab.href) : null;

  return (
    <>
      <nav ref={ref} aria-label={labels['workspace.navigation']}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border-line bg-surface-ivory/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-xl md:hidden">
        <ul className="mx-auto flex max-w-content items-stretch px-4">
          {tabs.map((tab) => {
            const active = isWorkspaceTabActive(tab, navigation, pathname, search);
            const className = `flex min-h-64 w-full min-w-0 flex-col items-center justify-center gap-4 rounded-md px-4 py-8 text-center text-small ${FOCUS_STYLE} ${active
              ? 'font-semibold text-brand-andaman' : 'text-text-secondary hover:text-brand-andaman'}`;
            const content = <><NavigationIcon id={tab.id} /><span className="w-full break-words text-[11px] leading-tight">{labels[tab.labelKey]}</span></>;
            return (
              <li key={tab.id} className="min-w-0 flex-1">
                {tab.href ? (
                  <Link prefetch={false} href={tab.href} aria-current={active ? 'page' : undefined} className={className}>{content}</Link>
                ) : (
                  <button type="button" className={className} aria-haspopup="dialog"
                    aria-expanded={sheet?.tab.id === tab.id} aria-controls={sheet?.tab.id === tab.id ? dialogId : undefined}
                    aria-current={active ? 'page' : undefined}
                    onClick={(event) => setSheet({ tab, trigger: event.currentTarget })}>{content}</button>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      {sheet && currentSheetTab ? <WorkspaceSheet id={dialogId} sheet={{ ...sheet, tab: currentSheetTab }} links={more} labels={labels} onClose={close} /> : null}
    </>
  );
}

function WorkspaceSheet({ id, sheet, links, labels, onClose }: {
  id: string;
  sheet: NonNullable<SheetState>;
  links: ResolvedNavigation['more'];
  labels: WorkspaceNavigationLabels;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const reasonId = useId();
  const unavailable = Boolean(sheet.tab.unavailableReason);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), select, [tabindex="0"]');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    const onFocus = (event: FocusEvent) => {
      if (!dialogRef.current?.contains(event.target as Node)) closeRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('focusin', onFocus);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('focusin', onFocus);
      if (sheet.trigger.isConnected) sheet.trigger.focus();
    };
  }, [onClose, sheet.trigger]);

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-brand-deep/50 px-8 pt-24 md:items-center md:p-24"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} id={id} role="dialog" aria-modal="true" aria-labelledby={titleId}
        aria-describedby={unavailable ? reasonId : undefined}
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-lg border border-border-line bg-surface-paper p-20 shadow-float md:rounded-lg"
        style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom, 0px))' } as CSSProperties}>
        <div className="mb-12 flex items-center justify-between gap-12">
          <h2 id={titleId} className="font-display text-title text-text-ink">{labels[sheet.tab.labelKey]}</h2>
          <button ref={closeRef} type="button" onClick={onClose}
            className={`min-h-44 shrink-0 rounded-md px-12 py-8 text-small font-semibold text-brand-andaman ${FOCUS_STYLE}`}>
            {labels['workspace.close']}
          </button>
        </div>
        {unavailable ? (
          <>
            <p id={reasonId} className="mb-20 text-body text-text-secondary">
              {labels[sheet.tab.unavailableReason === 'not_authorized' ? 'workspace.notAuthorized' : 'workspace.notAvailable']}
            </p>
            {sheet.tab.nextHref ? <Link prefetch={false} href={sheet.tab.nextHref} onClick={onClose}
              className={`flex min-h-44 items-center justify-center rounded-md bg-brand-andaman px-16 py-12 text-body font-semibold text-surface-ivory ${FOCUS_STYLE}`}>
              {labels['workspace.nextStep']}
            </Link> : null}
          </>
        ) : (
          <ul className="space-y-4">
            {links.map((link) => <li key={`${link.href}:${link.labelKey}`}><Link prefetch={false} href={link.href} onClick={onClose}
              className={`flex min-h-48 items-center rounded-md px-12 py-12 text-body text-text-ink hover:bg-surface-subtle ${FOCUS_STYLE}`}>
              {labels[link.labelKey]}
            </Link></li>)}
          </ul>
        )}
      </div>
    </div>, document.body,
  );
}
