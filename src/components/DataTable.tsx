import React from 'react';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  /** Right-aligns the column (amounts, tabular figures). */
  align?: 'left' | 'right';
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  className?: string;
}

/**
 * DataTable — doc 06 §3.2: "paper card, line row rules, sortable headers,
 * sticky header ≥ md; mobile collapses to key-value cards." Below `md` a
 * horizontal scroller is never the answer for data a person must act on
 * (CURSOR_PROMPT phase 7 rule) — the same rows render twice, and CSS
 * chooses which one is visible.
 */
export function DataTable<T>({ columns, rows, rowKey, className }: DataTableProps<T>) {
  return (
    <div className={className}>
      {/* Desktop / tablet: table, sticky header */}
      <div className="hidden md:block bg-surface-paper border border-border-line rounded-lg overflow-hidden">
        <table className="w-full border-collapse text-body">
          <thead>
            <tr className="text-left text-text-stone text-small sticky top-0 bg-surface-paper">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-12 py-12 font-medium ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="border-t border-border-line">
                {columns.map((col) => (
                  <td key={col.key} className={`px-12 py-16 ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: key-value cards, one per row */}
      <div className="md:hidden flex flex-col gap-12">
        {rows.map((row) => (
          <div key={rowKey(row)} className="bg-surface-paper border border-border-line rounded-lg p-16">
            {columns.map((col) => (
              <div key={col.key} className="flex justify-between gap-16 py-4">
                <span className="text-small text-text-stone">{col.header}</span>
                <span className="text-body text-text-ink text-right">{col.render(row)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
