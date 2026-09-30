'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { MyUNOMap } from '@/components/MyUNOMap';
import type { MapEntity, MapEntityKind } from '@/modules/map';

type FilterKey = 'all' | MapEntityKind;

export default function MapExplorer({ labels }: { labels: Record<string, string> }) {
  const [entities, setEntities] = useState<MapEntity[]>([]);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (filter !== 'all') params.set('kinds', filter);
        if (query.trim()) params.set('q', query.trim());
        const response = await fetch('/api/map/entities?' + params.toString(), {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(labels['map.error']);
        const data = await response.json();
        setEntities(Array.isArray(data.entities) ? data.entities : []);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError(err instanceof Error ? err.message : labels['map.error']);
        }
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [filter, query, labels]);

  const filters = useMemo(
    () => [
      { key: 'all' as const, label: labels['map.filter.all'] },
      { key: 'project' as const, label: labels['map.filter.projects'] },
      { key: 'unit' as const, label: labels['map.filter.homes'] },
      { key: 'provider' as const, label: labels['map.filter.partners'] },
      { key: 'service' as const, label: labels['map.filter.services'] },
    ],
    [labels]
  );

  return (
    <main className="min-h-screen bg-surface-ivory px-16 py-24 md:px-32">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-20">
          <h1 className="font-display text-display-xl font-semibold text-text-ink">
            {labels['map.title']}
          </h1>
          <p className="mt-8 max-w-3xl text-body text-text-secondary">
            {labels['map.subtitle']}
          </p>
        </div>

        <div className="mb-16 flex flex-col gap-12 lg:flex-row lg:items-center">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={labels['map.search_placeholder']}
            className="h-48 w-full rounded-full border border-border-line bg-surface-paper px-18 text-body text-text-ink lg:max-w-md"
          />
          <div className="flex flex-wrap gap-8">
            {filters.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={
                  filter === item.key
                    ? 'rounded-full bg-brand-andaman px-16 py-9 text-small font-semibold text-on-dark-text'
                    : 'rounded-full border border-border-line bg-surface-paper px-16 py-9 text-small font-semibold text-text-ink'
                }
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="text-small text-text-secondary lg:ml-auto">
            {labels['map.results'].replace('{count}', String(entities.length))}
          </p>
        </div>

        {error && (
          <div className="mb-16 rounded-lg border border-state-error bg-state-error-soft p-16 text-state-error">
            {error}
          </div>
        )}

        <div className="grid gap-16 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="max-h-[70vh] overflow-y-auto rounded-xl border border-border-line bg-surface-paper">
            {loading && <p className="p-20 text-body text-text-secondary">{labels['map.loading']}</p>}
            {!loading && entities.length === 0 && (
              <p className="p-20 text-body text-text-secondary">{labels['map.empty']}</p>
            )}
            {!loading &&
              entities.map((entity) => (
                <Link
                  key={entity.kind + ':' + entity.id}
                  href={entity.href}
                  onMouseEnter={() => setSelectedId(entity.id)}
                  onFocus={() => setSelectedId(entity.id)}
                  className={
                    selectedId === entity.id
                      ? 'block border-b border-border-line bg-surface-ivory p-16'
                      : 'block border-b border-border-line p-16 hover:bg-surface-ivory'
                  }
                >
                  <div className="flex items-start justify-between gap-12">
                    <div>
                      <p className="text-small font-semibold uppercase tracking-wide text-brand-andaman">
                        {entity.badge}
                      </p>
                      <h2 className="mt-4 text-body font-semibold text-text-ink">{entity.title}</h2>
                      {entity.subtitle && (
                        <p className="mt-4 text-small text-text-secondary">{entity.subtitle}</p>
                      )}
                    </div>
                    <span className="text-small font-semibold text-brand-andaman">
                      {labels['map.open']}
                    </span>
                  </div>
                </Link>
              ))}
          </aside>

          <MyUNOMap
            entities={entities}
            selectedId={selectedId}
            onSelect={(entity) => setSelectedId(entity.id)}
          />
        </div>
      </div>
    </main>
  );
}
