'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { matchPlaces, type PlaceOption } from '@/lib/place-search';

type RouteKey = 'stay' | 'monthly' | 'buy' | 'move' | 'services' | 'owner';

export function EcosystemEntry({ locale, places }: { locale: string; places: PlaceOption[] }) {
  const router = useRouter();
  const ru = locale === 'ru';
  const [query, setQuery] = useState('');
  const routes: { key: RouteKey; title: string; detail: string; href: string }[] = ru
    ? [
      { key: 'stay', title: 'Забронировать жильё', detail: 'Виллы и апартаменты', href: '/search' },
      { key: 'monthly', title: 'Арендовать надолго', detail: 'Жильё для жизни', href: '/homes?intent=rent' },
      { key: 'buy', title: 'Купить недвижимость', detail: 'Каталог предложений', href: '/homes?intent=buy' },
      { key: 'move', title: 'Переехать', detail: 'Жильё и организация переезда', href: '/relocation' },
      { key: 'services', title: 'Найти услугу', detail: 'Для отдыха и жизни', href: '/services' },
      { key: 'owner', title: 'Моя недвижимость', detail: 'Сдать, продать, управлять', href: '/owners' },
    ]
    : [
      { key: 'stay', title: 'Book a stay', detail: 'Villas and apartments', href: '/search' },
      { key: 'monthly', title: 'Rent long-term', detail: 'Homes for living', href: '/homes?intent=rent' },
      { key: 'buy', title: 'Buy property', detail: 'Properties for sale', href: '/homes?intent=buy' },
      { key: 'move', title: 'Relocate', detail: 'Homes and moving support', href: '/relocation' },
      { key: 'services', title: 'Find a service', detail: 'For everyday life and holidays', href: '/services' },
      { key: 'owner', title: 'My property', detail: 'Rent, sell or manage', href: '/owners' },
    ];
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
    <section aria-label={ru ? 'Выберите свою цель' : 'Choose your goal'} className="rounded-xl border border-border-line bg-surface-paper p-16 shadow-card md:p-24">
      <h2 className="font-display text-title font-semibold text-text-ink">{ru ? 'Что вы хотите сделать на Пхукете?' : 'What would you like to do in Phuket?'}</h2>
      <form onSubmit={submit} role="search" className="mt-16 flex flex-col gap-8 sm:flex-row">
        <label className="sr-only" htmlFor="ecosystem-query">{ru ? 'Поиск по myUNO' : 'Search myUNO'}</label>
        <input id="ecosystem-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ru ? 'Вилла, цветы, школа, район или услуга…' : 'Villa, flowers, school, area or service…'} className="min-h-48 min-w-0 flex-1 rounded-lg border border-border-line bg-surface-ivory px-16 text-text-ink" />
        <button type="submit" className="min-h-48 rounded-lg bg-brand-andaman px-24 font-semibold text-white">{ru ? 'Найти' : 'Search'}</button>
      </form>
      {matches.length > 0 && <div className="mt-8 flex flex-wrap gap-8" aria-label={ru ? 'Совпадения по месту' : 'Matching places'}>
        {matches.map((place) => <Link key={place.kind + ':' + place.id} className="rounded-lg border border-border-line px-12 py-8 text-small text-brand-andaman" href={place.kind === 'unit' ? '/units/' + encodeURIComponent(place.id) : place.kind === 'project' ? '/projects/' + encodeURIComponent(place.id) : '/search?areaSlug=' + encodeURIComponent(place.slug)}>{place.name}</Link>)}
      </div>}
      <div className="mt-20 grid grid-cols-2 gap-8 md:grid-cols-3">
        {routes.map((route) => <Link key={route.key} href={route.href} className="group flex min-w-0 flex-col rounded-lg border border-border-line bg-surface-ivory p-12 transition-colors hover:border-brand-andaman focus-visible:outline-2 focus-visible:outline-brand-andaman sm:p-16">
          <div className="flex min-w-0 items-start justify-between gap-4"><span className="min-w-0 break-normal text-small font-semibold leading-snug text-text-ink sm:text-body">{route.title}</span><span aria-hidden="true" className="shrink-0 text-brand-andaman">→</span></div>
          <p className="mt-6 hidden text-small leading-relaxed text-text-secondary sm:block">{route.detail}</p>
        </Link>)}
      </div>
    </section>
  );
}
