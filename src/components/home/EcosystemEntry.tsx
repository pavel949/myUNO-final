'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { matchPlaces, type PlaceOption } from '@/lib/place-search';

type RouteKey = 'stay' | 'monthly' | 'buy' | 'move' | 'services' | 'owner' | 'partner';

export function EcosystemEntry({ places, copy }: { places: PlaceOption[]; copy: Record<string, string> }) {
  const router = useRouter();
  
  const [query, setQuery] = useState('');
  const routeConfig: { key: RouteKey; href: string }[] = [
    { key: 'stay', href: '/search' },
    { key: 'monthly', href: '/homes?intent=rent' },
    { key: 'buy', href: '/homes?intent=buy' },
    { key: 'move', href: '/relocation' },
    { key: 'services', href: '/services' },
    { key: 'owner', href: '/owners' },
    { key: 'partner', href: '/partners' },
  ];
  const routes = routeConfig.map((route) => ({
    ...route,
    title: copy['route.' + route.key + '.title'],
    detail: copy['route.' + route.key + '.detail'],
  }));
  const matches = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (term.length < 2) return [];
    return matchPlaces(places, term, 6);
  }, [places, query]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;
    const lower = term.toLocaleLowerCase();
    const intent = /цвет|flower|букет|трансфер|transfer|spa|массаж|massage|услуг|service/.test(lower)
      ? '/services'
      : /купить|buy|purchase|продаж|инвест|invest/.test(lower)
        ? '/homes?intent=buy'
        : /переезд|переехать|relocat|moving|школ|school|visa|виз/.test(lower)
          ? '/relocation'
          : /месяц|monthly|long.term|долгосроч/.test(lower)
            ? '/homes?intent=rent'
            : '/search';
    const separator = intent.includes('?') ? '&' : '?';
    router.push(intent + separator + 'q=' + encodeURIComponent(term));
  }

  return (
    <section aria-label={copy.aria} className="rounded-lg border border-border-line bg-surface-paper p-16 shadow-card md:p-24">
      <h2 className="font-display text-title font-semibold text-text-ink">{copy.heading}</h2>
      <form onSubmit={submit} role="search" className="mt-16 flex flex-col gap-8 sm:flex-row">
        <label className="sr-only" htmlFor="ecosystem-query">{copy.searchLabel}</label>
        <input id="ecosystem-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.placeholder} className="min-h-48 min-w-0 flex-1 rounded-lg border border-border-line bg-surface-ivory px-16 text-text-ink" />
        <button type="submit" className="min-h-48 rounded-lg bg-brand-andaman px-24 font-semibold text-white">{copy.submit}</button>
      </form>
      {matches.length > 0 && <div className="mt-8 flex flex-wrap gap-8" aria-label={copy.matches}>
        {matches.map((place) => <Link key={place.kind + ':' + place.id} className="rounded-lg border border-border-line px-12 py-8 text-small text-brand-andaman" href={place.kind === 'unit' ? '/units/' + encodeURIComponent(place.id) : place.kind === 'project' ? place.slug ? '/projects/' + encodeURIComponent(place.slug) : '/search?projectId=' + encodeURIComponent(place.id) : place.slug ? '/search?areaSlug=' + encodeURIComponent(place.slug) : '/search'}>{place.name}</Link>)}
      </div>}
      <div className="mt-20 grid grid-cols-2 gap-8 md:grid-cols-3">
        {routes.map((route) => <Link key={route.key} href={route.href} className="group flex min-w-0 flex-col rounded-lg border border-border-line bg-surface-ivory p-12 transition-colors hover:border-brand-andaman focus-visible:outline-2 focus-visible:outline-brand-andaman sm:p-16">
          <div className="flex min-w-0 items-start justify-between gap-4"><span className="min-w-0 break-normal hyphens-none [overflow-wrap:normal] [word-break:normal] text-small font-semibold leading-snug text-text-ink sm:text-body">{route.title}</span><span aria-hidden="true" className="shrink-0 text-brand-andaman">→</span></div>
          <p className="mt-8 hidden text-small leading-relaxed text-text-secondary sm:block">{route.detail}</p>
        </Link>)}
      </div>
    </section>
  );
}
