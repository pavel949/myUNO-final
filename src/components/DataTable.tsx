'use client';

import React from 'react';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  numeric?: boolean;
  render?: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: React.ReactNode;
}

export function DataTable<T>({ columns, rows, rowKey, empty }: DataTableProps<T>) {
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');

  const sorted = React.useMemo(() => {
    if (!sortKey) return rows;
    const column = columns.find((item) => item.key === sortKey);
    if (!column) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = column.sortValue ? column.sortValue(a) : String((a as Record<string, unknown>)[column.key] ?? '');
      const bv = column.sortValue ? column.sortValue(b) : String((b as Record<string, unknown>)[column.key] ?? '');
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [columns, rows, sortDir, sortKey]);

  const onSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir('asc');
  };

  const cell = (row: T, column: DataTableColumn<T>) =>
    column.render ? column.render(row) : String((row as Record<string, unknown>)[column.key] ?? '');

  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <div className="bg-surface-paper rounded-lg border border-border-line">
      <div className="md:hidden divide-y divide-border-line">
        {sorted.map((row) => (
          <dl key={rowKey(row)} className="p-16 space-y-12">
            {columns.map((column) => (
              <div key={column.key} className="flex justify-between gap-16">
                <dt className="text-small text-text-stone">{column.header}</dt>
                <dd
                  className={`text-body text-text-ink text-right ${
                    column.numeric ? 'font-display tabular-nums' : ''
                  }`}
                >
                  {cell(row, column)}
                </dd>
              </div>
            ))}
          </dl>
        ))}
      </div>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse text-body">
          <thead className="sticky top-0 bg-surface-paper">
            <tr className="text-left text-small text-text-stone">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    sortKey === column.key
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                  className="px-12 py-12 first:pl-16 last:pr-16 font-medium"
                >
                  <button
                    type="button"
                    onClick={() => onSort(column.key)}
                    className="hover:text-text-ink"
                  >
                    {column.header}
                    {sortKey === column.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={rowKey(row)} className="border-t border-border-line">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-12 py-16 first:pl-16 last:pr-16 ${
                      column.numeric ? 'font-display font-medium tabular-nums' : ''
                    }`}
                  >
                    {cell(row, column)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
